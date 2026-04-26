<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReservationRequest;
use App\Models\Logement;
use App\Models\Reservation;
use App\Models\Tarif;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        // Vérification des conflits de dates
        $conflit = Reservation::where('logement_id', $logement->id)
            ->where('statut', '!=', 'annulee')
            ->where(function ($q) use ($request) {
                $q->whereBetween('date_debut', [$request->date_debut, $request->date_fin])
                  ->orWhereBetween('date_fin', [$request->date_debut, $request->date_fin])
                  ->orWhere(function ($q) use ($request) {
                      $q->where('date_debut', '<=', $request->date_debut)
                        ->where('date_fin', '>=', $request->date_fin);
                  });
            })->exists();

        if ($conflit) {
            return response()->json(['message' => 'Ce logement est déjà réservé pour ces dates.'], 409);
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

        return response()->json($reservation->load(['logement.villa', 'tarif']), 201);
    }

    public function show(Reservation $reservation): JsonResponse
    {
        return response()->json($reservation->load(['logement.villa', 'tarif', 'paiement']));
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

        return response()->json($reservation);
    }
}
