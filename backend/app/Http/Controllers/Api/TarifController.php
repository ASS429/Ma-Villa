<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\TarifRequest;
use App\Models\Logement;
use App\Models\Tarif;
use Illuminate\Http\JsonResponse;

class TarifController extends Controller
{
    public function index(Logement $logement): JsonResponse
    {
        return response()->json($logement->tarifs);
    }

    public function store(TarifRequest $request, Logement $logement): JsonResponse
    {
        $this->authorize('update', $logement->villa);
        $tarif = $logement->tarifs()->create($request->validated());

        return response()->json($tarif, 201);
    }

    public function update(TarifRequest $request, Logement $logement, Tarif $tarif): JsonResponse
    {
        $this->authorize('update', $logement->villa);
        $tarif->update($request->validated());

        return response()->json($tarif);
    }

    public function destroy(Logement $logement, Tarif $tarif): JsonResponse
    {
        $this->authorize('update', $logement->villa);
        $tarif->delete();

        return response()->json(['message' => 'Tarif supprimé.']);
    }
}
