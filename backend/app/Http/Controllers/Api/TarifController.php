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
        abort_unless($logement->villa?->visiblePour(auth('sanctum')->user()), 404);

        return response()->json($logement->tarifs);
    }

    public function store(TarifRequest $request, Logement $logement): JsonResponse
    {
        $this->authorize('update', $logement->villa);
        if ($refus = $this->prixTenusParLesAssocies($logement)) {
            return $refus;
        }
        $tarif = $logement->tarifs()->create($request->validated());

        return response()->json($tarif, 201);
    }

    public function update(TarifRequest $request, Logement $logement, Tarif $tarif): JsonResponse
    {
        $this->authorize('update', $logement->villa);
        if ($refus = $this->prixTenusParLesAssocies($logement)) {
            return $refus;
        }
        $tarif->update($request->validated());

        return response()->json($tarif);
    }

    public function destroy(Logement $logement, Tarif $tarif): JsonResponse
    {
        $this->authorize('update', $logement->villa);
        if ($refus = $this->prixTenusParLesAssocies($logement)) {
            return $refus;
        }
        $tarif->delete();

        return response()->json(['message' => 'Tarif supprimé.']);
    }
    /**
     * Sur le circuit des associés, le prix affiché comprend notre part : le
     * propriétaire qui le « corrige » en y remettant son propre prix la ferait
     * disparaître, et toucherait moins qu'il ne croit. Ces prix passent par
     * le gérant hébergement, et l'admin les change.
     */
    private function prixTenusParLesAssocies(Logement $logement): ?JsonResponse
    {
        if ($logement->villa?->passeParLesAssocies() && request()->user()?->role !== 'admin') {
            return response()->json([
                'message' => "Les prix de cette annonce se fixent avec le gérant hébergement de PasseTemps : écrivez-nous pour les changer.",
            ], 403);
        }

        return null;
    }
}
