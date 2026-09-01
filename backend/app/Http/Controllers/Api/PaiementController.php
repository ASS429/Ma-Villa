<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Paiement;
use App\Models\Reservation;
use App\Services\Commission;
use App\Services\PayDunya;
use App\Services\Push;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PaiementController extends Controller
{
    public function __construct(
        private readonly PayDunya $paydunya,
        private readonly Push $push,
    ) {
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

        // Le prestataire refuse en dessous d'un plancher. Le laisser refuser
        // renverrait une 502 : un échec qui accuse la plateforme, alors que le
        // montant seul est en cause et que le client n'y peut rien.
        $minimum = (int) config('paiement.montant_minimum');
        if ($repartition->montantClient < $minimum) {
            return response()->json([
                'message' => "Le paiement en ligne accepte {$minimum} FCFA au minimum. "
                    .'Réglez directement avec le propriétaire, qui vous contactera.',
            ], 422);
        }

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
                // Le numéro qui paie n'est pas celui du compte : on s'inscrit
                // avec son téléphone et on paie avec le Wave d'un proche. Sans
                // lui, un remboursement n'a pas d'adresse.
                'telephone_payeur' => $donnees['telephone'],
                'statut'         => 'en_attente',
                'reference'      => $reference,
                'token_paydunya' => $facture['token'],
            ]);
            $paiement->appliquerRepartition($repartition);
            $paiement->save();

            $resultat = $this->lancerSoftpay(
                $facture, $donnees['methode'], $request->user(), $donnees['telephone']
            );

            $lienApplication = $resultat['url_application'] ?? $resultat['url'];

            if (! $resultat['url'] && ! $lienApplication) {
                // Un paiement accepté sans lien ne mène nulle part. Le dire vaut
                // mieux qu'un écran d'attente devant lequel il n'y a rien à faire.
                throw new \RuntimeException(
                    'PayDunya a accepté le paiement sans renvoyer de lien à ouvrir.'
                );
            }

            // Conservés en base : l'écran d'attente doit pouvoir reproposer le
            // lien après un rechargement ou un retour depuis l'application.
            $paiement->update([
                'url_paiement'    => $resultat['url'] ?? $lienApplication,
                'url_application' => $lienApplication,
            ]);

            return response()->json([
                'reference'       => $reference,
                'url'             => $resultat['url'],
                'url_application' => $resultat['url_application'] ?? null,
                // Secours affichés en second : l'autre application du payeur,
                // et la page à QR code du prestataire.
                'url_maxit'       => $resultat['url_maxit'] ?? null,
                'url_om'          => $resultat['url_om'] ?? null,
                'url_page'        => $resultat['url_page'] ?? null,
                'montant'         => $repartition->montantClient,
                // Vrai quand on est passé par la page du prestataire faute de
                // SoftPay : l'interface annonce alors une étape de plus.
                'repli'           => $resultat['repli'] ?? false,
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
     * Déclenche SoftPay, ou se replie sur la page de paiement du prestataire.
     *
     * SoftPay ouvre Wave ou Orange Money sans étape intermédiaire — c'est le
     * parcours qu'on veut, et il faut le préférer. Mais il demande une
     * activation côté PayDunya : tant qu'elle n'est pas faite, l'appel répond
     * sans rien, alors que la facture créée juste avant reste parfaitement
     * payable sur leur page.
     *
     * Renoncer à ce moment-là coûte la vente ; se replier coûte une étape au
     * client. Le repli est journalisé en avertissement : permanent, il signale
     * un SoftPay à faire activer, pas un fonctionnement normal.
     *
     * @param array{token: string, url: ?string, brut: array} $facture
     * @return array<string, mixed>
     */
    private function lancerSoftpay(array $facture, string $methode, object $payeur, string $telephone): array
    {
        // Avec des clés de test, SoftPay n'existe pas : l'essayer coûterait une
        // requête pour une 404 certaine, et un avertissement dans le journal à
        // chaque paiement — de quoi noyer le signal qu'on veut y voir.
        if (! $this->paydunya->softpayDisponible() && $facture['url'] && config('paiement.repli_checkout')) {
            return [
                'url'             => $facture['url'],
                'url_application' => $facture['url'],
                'repli'           => true,
            ];
        }

        try {
            return $methode === 'wave'
                ? $this->paydunya->payerAvecWave($facture['token'], $payeur->name, $payeur->email, $telephone)
                : $this->paydunya->payerAvecOrangeMoney($facture['token'], $payeur->name, $payeur->email, $telephone);
        } catch (\Throwable $e) {
            if (! config('paiement.repli_checkout') || ! $facture['url']) {
                throw $e;
            }

            Log::warning('SoftPay indisponible, repli sur la page de paiement', [
                'methode' => $methode,
                'erreur'  => $e->getMessage(),
            ]);

            return [
                'url'             => $facture['url'],
                'url_application' => $facture['url'],
                'repli'           => true,
            ];
        }
    }

    /**
     * Notification instantanée de PayDunya (IPN).
     *
     * Règle non négociable : **le corps reçu n'est jamais une source de vérité.**
     * C'est un POST sur une URL publique ; n'importe qui peut y annoncer
     * « paiement réussi » et s'offrir une réservation. La signature est un
     * rempart, mais c'est un secret partagé constant : il suffit qu'il fuite une
     * fois pour que tout le passé et l'avenir soient forgeables.
     *
     * La notification ne sert donc qu'à *retrouver* la facture. L'issue, elle,
     * est redemandée à PayDunya par un appel sortant authentifié par nos clés.
     * Seul ce retour-là confirme une réservation.
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

        if ($paiement->estRegle()) {
            return response()->json(['message' => 'Déjà traité.']);
        }

        $this->reglerDepuisPrestataire($paiement);

        return response()->json(['message' => 'Reçu.']);
    }

    /**
     * État d'un paiement, interrogé par l'écran d'attente.
     *
     * Tant que le paiement est en cours, on redemande son issue à PayDunya au
     * lieu d'attendre une notification qui peut ne jamais venir — c'est le cas
     * courant en bac à sable, et cela arrive en production quand l'IPN se perd.
     * Sans cela, l'écran « Confirmez sur votre téléphone » tourne indéfiniment
     * sur un paiement pourtant abouti.
     */
    public function statut(Request $request, Reservation $reservation): JsonResponse
    {
        $this->authorize('view', $reservation);
        $paiement = $reservation->paiement;
        $cotePrestataire = null;

        if ($paiement && $paiement->statut === 'en_attente' && $paiement->token_paydunya) {
            $cotePrestataire = $this->reglerDepuisPrestataire($paiement);
            $paiement->refresh();
            $reservation->refresh();
        }

        $reponse = [
            'statut'              => $paiement?->statut ?? 'aucun',
            'reference'           => $paiement?->reference,
            'montant'             => $paiement?->montant,
            'reservation_statut'  => $reservation->statut,
        ];

        // Hors encaissement réel : ce que le prestataire répond, mot pour mot.
        // « Rien ne se passe » est indéchiffrable ; « PayDunya répond pending »
        // dit où regarder — la facture n'a pas encore été réglée chez eux.
        if ($cotePrestataire !== null && $this->paydunya->sansEncaissementReel()) {
            $reponse['prestataire'] = $cotePrestataire;
        }

        return response()->json($reponse);
    }

    /**
     * Demande l'issue à PayDunya et l'applique — la seule voie par laquelle une
     * réservation devient « confirmée ».
     *
     * Ne fait rien tant que le prestataire ne répond pas ou n'a pas tranché :
     * ne rien savoir doit rester distinct de « refusé », sous peine d'annuler
     * un paiement en cours sur une simple coupure réseau.
     *
     * @return string|null Le statut brut du prestataire, ou null s'il n'a pas répondu.
     */
    private function reglerDepuisPrestataire(Paiement $paiement): ?string
    {
        $verifie = $this->paydunya->statutFacture((string) $paiement->token_paydunya);

        if ($verifie === null) {
            return null;
        }

        $statut = match ($verifie['statut']) {
            'completed' => 'reussi',
            'cancelled', 'failed' => 'echoue',
            default => null,
        };

        if ($statut === null) {
            return $verifie['statut'];
        }

        // Le montant encaissé doit être celui qu'on a demandé. Un écart signale
        // une facture qui n'est pas la nôtre, ou un barème changé en cours de
        // route : dans les deux cas, mieux vaut ne rien confirmer.
        $attendu = (int) round((float) $paiement->montant);
        $recu = $verifie['montant'] !== null ? (int) round((float) $verifie['montant']) : $attendu;

        if ($statut === 'reussi' && $recu !== $attendu) {
            Log::error('Montant encaissé différent du montant attendu', [
                'paiement' => $paiement->id,
                'attendu'  => $attendu,
                'recu'     => $recu,
            ]);

            return $verifie['statut'];
        }

        DB::transaction(function () use ($paiement, $statut, $verifie) {
            $paiement->update([
                'statut'              => $statut,
                'reponse_prestataire' => $verifie['brut'],
                'paye_le'             => $statut === 'reussi' ? now() : null,
            ]);

            // Un paiement abouti confirme la réservation sans intervention du
            // propriétaire : le client a payé, la place lui est due.
            if ($statut === 'reussi') {
                $paiement->reservation->update(['statut' => 'confirmee']);
            }
        });

        // Le propriétaire doit apprendre qu'une nuit est vendue sans avoir à
        // ouvrir son tableau de bord : c'est lui qui doit préparer la venue.
        // Après la transaction, pour qu'un service de poussée lent ne tienne
        // pas ouverte une transaction de base de données.
        if ($statut === 'reussi') {
            $paiement->loadMissing('reservation.logement.villa.proprietaire');

            $this->push->versUtilisateur($paiement->reservation->logement->villa->proprietaire, [
                'titre' => 'Réservation payée',
                'corps' => $paiement->reservation->logement->villa->nom
                    .' — '.number_format((float) $paiement->montant, 0, ',', ' ').' FCFA encaissés',
                'url' => '/dashboard/reservations',
                'groupe' => "reservation-{$paiement->reservation_id}",
            ]);
        }

        return $verifie['statut'];
    }
}
