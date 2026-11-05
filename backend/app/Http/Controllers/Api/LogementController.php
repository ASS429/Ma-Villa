<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LogementRequest;
use App\Models\Logement;
use App\Models\Villa;
use Illuminate\Http\JsonResponse;

class LogementController extends Controller
{
    public function index(Villa $villa): JsonResponse
    {
        abort_unless($villa->visiblePour(auth('sanctum')->user()), 404);

        return response()->json($villa->logements()->with(['tarifs', 'photos'])->get());
    }

    public function store(LogementRequest $request, Villa $villa): JsonResponse
    {
        $this->authorize('update', $villa);
        $logement = $villa->logements()->create($request->donnees());

        return response()->json($logement, 201);
    }

    public function show(Villa $villa, Logement $logement): JsonResponse
    {
        abort_unless($villa->visiblePour(auth('sanctum')->user()), 404);

        return response()->json($logement->load(['tarifs', 'photos', 'disponibilites']));
    }

    public function update(LogementRequest $request, Villa $villa, Logement $logement): JsonResponse
    {
        $this->authorize('update', $villa);
        $logement->update($request->donnees());

        return response()->json($logement);
    }

    public function toggleDisponibilite(Villa $villa, Logement $logement): JsonResponse
    {
        $this->authorize('update', $villa);
        $logement->update(['disponible' => !$logement->disponible]);

        return response()->json($logement);
    }

    public function destroy(Villa $villa, Logement $logement): JsonResponse
    {
        $this->authorize('update', $villa);

        // La suppression emporte réservations et paiements : l'argent reçu sur ce logement
        // disparaîtrait de ce qu'on doit au propriétaire ou au client.
        if ($logement->reservations()->whereHas('paiement', fn ($q) => $q->where('statut', 'reussi'))->exists()) {
            return response()->json([
                'message' => 'Ce logement a des réservations payées : il ne se supprime pas. Rendez-le indisponible.',
            ], 409);
        }

        $logement->delete();

        return response()->json(['message' => 'Logement supprimé.']);
    }
}
