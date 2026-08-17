<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Paiement;
use App\Models\Reservation;
use App\Services\Commission;
use App\Services\PayDunya;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PaiementController extends Controller
{
    public function __construct(private readonly PayDunya $paydunya)
    {
    }

    /**
     * Démarre un paiement et renvoie l'URL vers laquelle envoyer le payeur.
     *
     * Rien n'est considéré comme réglé ici : la confirmation arrive plus tard
     * sur l'IPN. Le temps que le client tape son code sur son téléphone, cette
     * requête est terminée depuis longtemps.
     */
    public function initier(Request $request, Reservation $reservation): JsonResponse
    {
        $this->authorize('view', $reservation);

        if (! config('paiement.actif')) {
            return response()->json(['message' => 'Le paiement en ligne n\'est pas encore ouvert.'], 503);
        }

        $donnees = $request->validate([
            'methode'   => 'required|in:wave,orange_money',
            'telephone' => 'required|string|max:30',
        ]);

        if ($reservation->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Seul le client peut régler sa réservation.'], 403);
        }

        if ($reservation->statut === 'annulee') {
            return response()->json(['message' => 'Cette réservation est annulée.'], 409);
        }

        if ($reservation->paiement?->estRegle()) {
            return response()->json(['message' => 'Cette réservation est déjà réglée.'], 409);
        }

        $repartition = Commission::pour($reservation->montant_total);
        $reservation->loadMissing('logement.villa');

        try {
            $facture = $this->paydunya->creerFacture(
                montant: $repartition->montantClient,
                description: "Réservation {$reservation->logement->villa->nom} — {$reservation->logement->nom}",
                articles: [
                    'item_0' => [
                        'name'        => $reservation->logement->villa->nom,
                        'quantity'    => 1,
                        'unit_price'  => (string) $repartition->montantClient,
                        'total_price' => (string) $repartition->montantClient,
                        'description' => "Du {$reservation->date_debut} au {$reservation->date_fin}",
                    ],
                ],
                // Ces données nous reviennent telles quelles dans l'IPN : c'est
                // par là qu'on retrouve la réservation, sans faire confiance à
                // un identifiant transmis par le navigateur.
                donneesPersonnalisees: [
                    'reservation_id' => (string) $reservation->id,
                    'reference'      => $reference = 'MV-'.Str::upper(Str::random(10)),
                ],
                // Wave et Orange Money renvoient le payeur ici : son propre
                // écran d'attente, qui interroge le serveur jusqu'à l'IPN.
                urlRetour: rtrim((string) config('app.frontend_url'), '/')
                    ."/reservation/{$reservation->id}/paiement",
            );

            $paiement = $reservation->paiement ?? new Paiement(['reservation_id' => $reservation->id]);
            $paiement->fill([
                'methode'        => $donnees['methode'],
                'statut'         => 'en_attente',
                'reference'      => $reference,
                'token_paydunya' => $facture['token'],
            ]);
            $paiement->appliquerRepartition($repartition);
            $paiement->save();

            $resultat = $donnees['methode'] === 'wave'
                ? $this->paydunya->payerAvecWave(
                    $facture['token'], $request->user()->name, $request->user()->email, $donnees['telephone']
                )
                : $this->paydunya->payerAvecOrangeMoney(
                    $facture['token'], $request->user()->name, $request->user()->email, $donnees['telephone']
                );

            $paiement->update(['url_paiement' => $resultat['url']]);

            return response()->json([
                'reference'       => $reference,
                'url'             => $resultat['url'],
                'url_application' => $resultat['url_application'] ?? null,
                'url_maxit'       => $resultat['url_maxit'] ?? null,
                'montant'         => $repartition->montantClient,
            ]);
        } catch (\Throwable $e) {
            Log::error('Initiation de paiement échouée', [
                'reservation' => $reservation->id,
                'methode'     => $donnees['methode'],
                'mode'        => config('paiement.paydunya.mode'),
                'erreur'      => $e->getMessage(),
            ]);

            $reponse = ['message' => 'Le paiement n\'a pas pu être lancé. Réessayez dans un instant.'];

            // Hors encaissement réel, la cause exacte accompagne le refus. Sans
            // elle, un échec n'est lisible que dans les journaux du serveur :
            // celui qui teste voit « réessayez » et n'a rien sur quoi agir,
            // alors que « clé maîtresse refusée » se corrige en une minute.
            //
            // La question est posée au service, pas à la configuration : des
            // clés de test sous un mode « live » ne prennent aucun franc, et
            // c'est précisément le cas qu'il faut pouvoir diagnostiquer.
            if ($this->paydunya->sansEncaissementReel()) {
                $reponse['raison'] = $e->getMessage();
            }

            return response()->json($reponse, 502);
        }
    }

    /**
     * Notification instantanée de PayDunya (IPN).
     *
     * C'est la seule source de vérité sur l'issue d'un paiement, et c'est une
     * URL publique : sans vérification du hash, n'importe qui pourrait annoncer
     * « paiement réussi » et s'offrir une réservation.
     */
    public function ipn(Request $request): JsonResponse
    {
        $donnees = $request->input('data', []);

        if (! $this->paydunya->notificationAuthentique($donnees['hash'] ?? null)) {
            Log::warning('IPN rejetée : signature invalide', ['ip' => $request->ip()]);

            return response()->json(['message' => 'Signature invalide.'], 403);
        }

        $jeton = $donnees['invoice']['token'] ?? null;
        $paiement = $jeton ? Paiement::where('token_paydunya', $jeton)->first() : null;

        if (! $paiement) {
            Log::warning('IPN sans paiement correspondant', ['token' => $jeton]);

            // 200 volontaire : un 404 ferait réessayer PayDunya indéfiniment
            // pour une facture qui ne nous concerne pas.
            return response()->json(['message' => 'Inconnu.']);
        }

        $statut = match ($donnees['status'] ?? '') {
            'completed' => 'reussi',
            'cancelled', 'failed' => 'echoue',
            default => null,
        };

        if ($statut === null) {
            return response()->json(['message' => 'Statut ignoré.']);
        }

        // L'IPN peut arriver plusieurs fois pour la même transaction : le
        // traitement doit être idempotent, sinon une réservation serait
        // confirmée deux fois.
        if ($paiement->estRegle()) {
            return response()->json(['message' => 'Déjà traité.']);
        }

        DB::transaction(function () use ($paiement, $statut, $donnees) {
            $paiement->update([
                'statut'              => $statut,
                'reponse_prestataire' => $donnees,
                'paye_le'             => $statut === 'reussi' ? now() : null,
            ]);

            // Un paiement abouti confirme la réservation sans intervention du
            // propriétaire : le client a payé, la place lui est due.
            if ($statut === 'reussi') {
                $paiement->reservation->update(['statut' => 'confirmee']);
            }
        });

        return response()->json(['message' => 'Reçu.']);
    }

    /** État d'un paiement, interrogé par le front pendant l'attente. */
    public function statut(Request $request, Reservation $reservation): JsonResponse
    {
        $this->authorize('view', $reservation);
        $paiement = $reservation->paiement;

        return response()->json([
            'statut'              => $paiement?->statut ?? 'aucun',
            'reference'           => $paiement?->reference,
            'montant'             => $paiement?->montant,
            'reservation_statut'  => $reservation->statut,
        ]);
    }
}
