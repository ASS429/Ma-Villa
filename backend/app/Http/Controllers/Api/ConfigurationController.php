<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * Expose au front les options activées côté serveur, pour qu'une bascule
 * (le paiement en ligne, notamment) ne demande pas de redéployer l'interface.
 */
class ConfigurationController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'paiement' => [
                'actif'  => (bool) config('paiement.actif'),
                'moyens' => config('paiement.moyens'),
            ],
        ]);
    }
}
