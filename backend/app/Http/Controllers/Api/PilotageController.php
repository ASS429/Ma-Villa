<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Pilotage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Le tableau de pilotage de la console. Voir `Pilotage`.
 *
 * L'export Excel et CSV se prépare dans le navigateur, à partir de cette même
 * réponse : le fichier dit donc exactement ce que l'écran affiche.
 */
class PilotageController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $d = $request->validate([
            'du' => 'sometimes|nullable|date',
            'au' => 'sometimes|nullable|date|after_or_equal:du',
        ], [
            'au.after_or_equal' => 'La fin de la période ne peut pas précéder son début.',
        ]);

        $au = Carbon::parse($d['au'] ?? now());
        $du = Carbon::parse($d['du'] ?? $au->copy()->subDays(29));

        if ($du->diffInDays($au) > 1100) {
            return response()->json([
                'message' => 'Choisissez une période de trois ans au plus.',
                'errors'  => ['du' => ['Choisissez une période de trois ans au plus.']],
            ], 422);
        }

        return response()->json(Pilotage::pour($du, $au));
    }
}
