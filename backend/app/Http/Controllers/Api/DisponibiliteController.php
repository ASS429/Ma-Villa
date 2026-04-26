<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DisponibiliteRequest;
use App\Models\Logement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DisponibiliteController extends Controller
{
    public function index(Logement $logement, Request $request): JsonResponse
    {
        $query = $logement->disponibilites();

        if ($request->date_debut && $request->date_fin) {
            $query->where(function ($q) use ($request) {
                $q->whereBetween('date_debut', [$request->date_debut, $request->date_fin])
                  ->orWhereBetween('date_fin', [$request->date_debut, $request->date_fin]);
            });
        }

        return response()->json($query->get());
    }

    public function store(DisponibiliteRequest $request, Logement $logement): JsonResponse
    {
        $this->authorize('update', $logement->villa);
        $dispo = $logement->disponibilites()->create($request->validated());

        return response()->json($dispo, 201);
    }

    public function destroy(Logement $logement, int $disponibilite): JsonResponse
    {
        $this->authorize('update', $logement->villa);
        $logement->disponibilites()->findOrFail($disponibilite)->delete();

        return response()->json(['message' => 'Disponibilité supprimée.']);
    }
}
