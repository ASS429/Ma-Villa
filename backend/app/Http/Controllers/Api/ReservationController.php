<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReservationRequest;
use App\Models\Logement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Notifications\NouvelleReservation;
use App\Notifications\ReservationMiseAJour;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ReservationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $reservations = $user->role === 'proprietaire'
            ? Reservation::whereHas('logement.villa', fn($q) => $q->where('user_id', $user->id))
                ->with(['logement.villa', 'tarif', 'client'])->get()
            : $user->reservations()->with(['logement.villa', 'tarif'])->get();

        return response()->json($reservations);
    }

    public function store(ReservationRequest $request): JsonResponse
    {
        $logement = Logement::findOrFail($request->logement_id);
        $tarif = Tarif::findOrFail($request->tarif_id);

        if (! $logement->disponible) {
            return response()->json(['message' => 'Ce logement n\'est plus proposé à la réservation.'], 409);
        }

        // Même règle de chevauchement que la recherche par dates : une villa
        // présentée comme libre doit rester réservable.
        $conflit = Reservation::where('logement_id', $logement->id)
            ->bloquante()
            ->chevauchant($request->date_debut, $request->date_fin)
            ->exists();

        if ($conflit) {
            return response()->json(['message' => 'Ce logement est déjà réservé pour ces dates.'], 409);
        }

        $bloque = $logement->disponibilites()
            ->where('disponible', false)
            ->where('date_debut', '<=', $request->date_fin)
            ->where('date_fin', '>=', $request->date_debut)
            ->exists();

        if ($bloque) {
            return response()->json(['message' => 'Ce logement n\'est pas disponible sur cette période.'], 409);
        }

        if ($request->nb_personnes > $logement->capacite) {
            return response()->json([
                'message' => "Ce logement accueille au maximum {$logement->capacite} personnes.",
            ], 422);
        }

        $jours = (int) (new \DateTime($request->date_debut))->diff(new \DateTime($request->date_fin))->days;
        $montant = $tarif->prix * max($jours, 1);

        $reservation = $request->user()->reservations()->create([
            'logement_id'   => $logement->id,
            'tarif_id'      => $tarif->id,
            'date_debut'    => $request->date_debut,
            'date_fin'      => $request->date_fin,
            'nb_personnes'  => $request->nb_personnes,
            'montant_total' => $montant,
        ]);

        $reservation->load(['logement.villa.proprietaire', 'tarif', 'client']);

        $this->notifier(
            $reservation->logement->villa->proprietaire,
            new NouvelleReservation($reservation)
        );

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
            $this->notifier(
                $reservation->loadMissing('client')->client,
                new ReservationMiseAJour($reservation)
            );
        }

        return response()->json($reservation);
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
