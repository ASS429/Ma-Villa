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
        return response()->json($villa->logements()->with(['tarifs', 'photos'])->get());
    }

    public function store(LogementRequest $request, Villa $villa): JsonResponse
    {
        $this->authorize('update', $villa);
        $logement = $villa->logements()->create($request->validated());

        return response()->json($logement, 201);
    }

    public function show(Villa $villa, Logement $logement): JsonResponse
    {
        return response()->json($logement->load(['tarifs', 'photos', 'disponibilites']));
    }

    public function update(LogementRequest $request, Villa $villa, Logement $logement): JsonResponse
    {
        $this->authorize('update', $villa);
        $logement->update($request->validated());

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
        $logement->delete();

        return response()->json(['message' => 'Logement supprimé.']);
    }
}
