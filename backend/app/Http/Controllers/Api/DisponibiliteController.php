<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DisponibiliteRequest;
use App\Models\Logement;
use App\Models\Reservation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DisponibiliteController extends Controller
{
    public function index(Logement $logement, Request $request): JsonResponse
    {
        $utilisateur = auth('sanctum')->user();
        abort_unless($logement->villa?->visiblePour($utilisateur), 404);

        $query = $logement->disponibilites()->orderBy('date_debut');

        // Même règle de chevauchement que la réservation. L'ancien filtre ne
        // regardait que les deux bornes, et oubliait la plage qui englobe toute
        // la période demandée.
        if ($request->date_debut && $request->date_fin) {
            $query->where('date_debut', '<=', $request->date_fin)
                  ->where('date_fin', '>=', $request->date_debut);
        }

        $plages = $query->get();

        // Le motif est une note du propriétaire pour lui-même (« loué sur
        // Airbnb à M. X ») : la route est publique, il ne sort que pour lui et
        // pour l'admin.
        if (! $utilisateur?->can('update', $logement->villa)) {
            $plages->each->makeHidden('motif');
        }

        return response()->json($plages);
    }

    public function store(DisponibiliteRequest $request, Logement $logement): JsonResponse
    {
        $this->authorize('update', $logement->villa);
        $dispo = $logement->disponibilites()->create($request->validated());

        // Fermer des dates n'annule rien. Si une réservation de la plateforme
        // tombe dedans, le propriétaire doit l'apprendre maintenant, pas à
        // l'arrivée du client.
        $reservations = Reservation::where('logement_id', $logement->id)
            ->bloquante()
            ->chevauchant($dispo->date_debut->toDateString(), $dispo->date_fin->toDateString())
            ->count();

        return response()->json($dispo->toArray() + ['reservations_concernees' => $reservations], 201);
    }

    public function destroy(Logement $logement, int $disponibilite): JsonResponse
    {
        $this->authorize('update', $logement->villa);
        $logement->disponibilites()->findOrFail($disponibilite)->delete();

        return response()->json(['message' => 'Disponibilité supprimée.']);
    }
}
