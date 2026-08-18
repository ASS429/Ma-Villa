<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReservationRequest;
use App\Models\Logement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Notifications\NouvelleReservation;
use App\Notifications\ReservationMiseAJour;
use App\Services\Push;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ReservationController extends Controller
{
    public function __construct(private readonly Push $push)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Le paiement fait partie de la liste : sans lui, le client ne sait pas
        // ce qui lui reste à régler, et n'a aucun chemin de retour vers le
        // tunnel une fois la page de la villa quittée.
        //
        // Colonnes choisies une par une : le jeton du prestataire et la
        // répartition de commission n'ont rien à faire dans une liste.
        $paiement = 'paiement:id,reservation_id,statut,reference,montant,paye_le';

        $reservations = $user->role === 'proprietaire'
            ? Reservation::whereHas('logement.villa', fn($q) => $q->where('user_id', $user->id))
                ->with(['logement.villa', 'tarif', 'client', $paiement])->get()
            : $user->reservations()->with(['logement.villa', 'tarif', $paiement])->get();

        return response()->json($reservations);
    }

    public function store(ReservationRequest $request): JsonResponse
    {
        $logement = Logement::findOrFail($request->logement_id);
        $tarif = Tarif::findOrFail($request->tarif_id);

        if (! $logement->disponible) {
            return response()->json(['message' => 'Ce logement n\'est plus proposé à la réservation.'], 409);
        }

        if ($request->nb_personnes > $logement->capacite) {
            return response()->json([
                'message' => "Ce logement accueille au maximum {$logement->capacite} personnes.",
            ], 422);
        }

        $jours = (int) (new \DateTime($request->date_debut))->diff(new \DateTime($request->date_fin))->days;
        $montant = $tarif->prix * max($jours, 1);

        // Vérifier puis créer sans verrou laisse passer deux demandes simultanées
        // sur les mêmes dates : chacune constate un créneau libre avant que
        // l'autre n'ait écrit. Sur une place de marché cela vend deux fois la
        // même nuit, et c'est le propriétaire qui l'apprend à l'arrivée des
        // clients. Le verrou porte sur la ligne du logement : deux demandes
        // concurrentes sur le même logement s'exécutent l'une après l'autre,
        // celles qui visent d'autres logements ne s'attendent pas.
        $resultat = DB::transaction(function () use ($request, $logement, $tarif, $montant) {
            Logement::whereKey($logement->id)->lockForUpdate()->first();

            // Même règle de chevauchement que la recherche par dates : une villa
            // présentée comme libre doit rester réservable.
            $conflit = Reservation::where('logement_id', $logement->id)
                ->bloquante()
                ->chevauchant($request->date_debut, $request->date_fin)
                ->exists();

            if ($conflit) {
                return ['message' => 'Ce logement est déjà réservé pour ces dates.', 'code' => 409];
            }

            $bloque = $logement->disponibilites()
                ->where('disponible', false)
                ->where('date_debut', '<=', $request->date_fin)
                ->where('date_fin', '>=', $request->date_debut)
                ->exists();

            if ($bloque) {
                return ['message' => 'Ce logement n\'est pas disponible sur cette période.', 'code' => 409];
            }

            return ['reservation' => $request->user()->reservations()->create([
                'logement_id'   => $logement->id,
                'tarif_id'      => $tarif->id,
                'date_debut'    => $request->date_debut,
                'date_fin'      => $request->date_fin,
                'nb_personnes'  => $request->nb_personnes,
                'montant_total' => $montant,
            ])];
        });

        if (isset($resultat['code'])) {
            return response()->json(['message' => $resultat['message']], $resultat['code']);
        }

        $reservation = $resultat['reservation'];
        $reservation->load(['logement.villa.proprietaire', 'tarif', 'client']);

        $proprietaire = $reservation->logement->villa->proprietaire;

        $this->notifier($proprietaire, new NouvelleReservation($reservation));

        // La poussée double l'email, elle ne le remplace pas : un propriétaire
        // qui n'a pas autorisé les notifications, ou dont l'abonnement a
        // expiré, doit apprendre la demande malgré tout.
        $this->push->versUtilisateur($proprietaire, [
            'titre' => 'Nouvelle demande de réservation',
            'corps' => "{$reservation->client->name} — {$reservation->logement->villa->nom}, "
                .'du '.$this->jour($reservation->date_debut).' au '.$this->jour($reservation->date_fin),
            'url' => '/dashboard/reservations',
            'groupe' => "reservation-{$reservation->id}",
        ]);

        return response()->json($reservation, 201);
    }

    public function show(Reservation $reservation): JsonResponse
    {
        // Sans cette vérification, n'importe quel compte connecté lisait la
        // réservation de n'importe qui en incrémentant l'identifiant.
        $this->authorize('view', $reservation);

        return response()->json($reservation->load(['logement.villa', 'tarif', 'paiement', 'client']));
    }

    public function updateStatut(Request $request, Reservation $reservation): JsonResponse
    {
        $request->validate(['statut' => 'required|in:confirmee,annulee']);
        $this->authorize('update', $reservation);

        // Un client ne peut qu'annuler, pas confirmer
        if ($request->user()->role === 'client' && $request->statut !== 'annulee') {
            return response()->json(['message' => 'Non autorisé.'], 403);
        }

        $reservation->update(['statut' => $request->statut]);

        // Le client doit apprendre la décision autrement qu'en rouvrant le site.
        // Inutile de se notifier soi-même quand c'est lui qui annule.
        if ($request->user()->id !== $reservation->user_id) {
            $client = $reservation->loadMissing('client')->client;

            $this->notifier($client, new ReservationMiseAJour($reservation));

            $confirmee = $request->statut === 'confirmee';
            $reservation->loadMissing('logement.villa');

            $this->push->versUtilisateur($client, [
                'titre' => $confirmee ? 'Réservation confirmée' : 'Réservation annulée',
                'corps' => $reservation->logement->villa->nom.' — '
                    .($confirmee
                        ? 'du '.$this->jour($reservation->date_debut).' au '.$this->jour($reservation->date_fin)
                        : 'le propriétaire n\'a pas pu donner suite'),
                'url' => '/dashboard/reservations',
                'groupe' => "reservation-{$reservation->id}",
            ]);
        }

        return response()->json($reservation);
    }

    /** Date au format court, pour tenir dans une notification système. */
    private function jour(mixed $date): string
    {
        return \Illuminate\Support\Carbon::parse((string) $date)->format('d/m');
    }

    /**
     * Un envoi d'email qui échoue ne doit jamais faire échouer la réservation
     * elle-même : la donnée métier est déjà enregistrée.
     */
    private function notifier(?object $destinataire, object $notification): void
    {
        if (! $destinataire) {
            return;
        }

        try {
            $destinataire->notify($notification);
        } catch (\Throwable $e) {
            Log::error('Notification non envoyée', [
                'notification' => $notification::class,
                'destinataire' => $destinataire->id ?? null,
                'erreur' => $e->getMessage(),
            ]);
        }
    }
}
