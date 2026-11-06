<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Deboursement;
use App\Services\Fonds;
use App\Services\PayDunya;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Ce qu'on peut retirer du compte PayDunya sans toucher à l'argent des autres.
 *
 * Une lecture seule : rien n'est retiré d'ici, et rien ne peut l'être. Le solde est lu chez
 * PayDunya, qui le donne lui-même pour une approximation : l'écran le dit, et renvoie à son
 * tableau de bord avant un gros retrait.
 */
class FondsController extends Controller
{
    /** Assez court pour suivre un retrait, assez long pour ne pas interroger PayDunya à chaque page. */
    private const CACHE_SECONDES = 120;

    public function __invoke(Request $request): JsonResponse
    {
        $paydunya = PayDunya::depuisConfig();
        $aGarder = Fonds::aGarder(false);
        $solde = $paydunya->estConfigure()
            ? $this->solde($request->boolean('rafraichir'))
            : ['lu' => false, 'montant' => null, 'message' => 'les clés PayDunya ne sont pas posées sur ce serveur', 'lu_le' => null];

        $montant = $solde['montant'];

        return response()->json([
            'configure'  => $paydunya->estConfigure(),
            'compte_test' => $paydunya->estConfigure() && $paydunya->clesDeTest(),
            'solde'      => $montant,
            'lu'         => $solde['lu'],
            'message'    => $solde['message'],
            'lu_le'      => $solde['lu_le'],
            'a_garder'   => $aGarder,
            'retirable'  => $montant === null ? null : max(0, $montant - $aGarder['total']),
            'manque'     => $montant === null ? null : max(0, $aGarder['total'] - $montant),
            'hors_ligne' => Fonds::aGarder(true),
        ]);
    }

    /**
     * Un échec ne se garde pas en cache : on veut réessayer au prochain affichage.
     *
     * @return array{lu: bool, montant: ?int, message: ?string, lu_le: ?string}
     */
    private function solde(bool $rafraichir): array
    {
        $cle = 'fonds.solde_paydunya';

        if (! $rafraichir && ($deja = Cache::get($cle))) {
            return $deja;
        }

        $lu = Deboursement::depuisConfig()->solde() + ['lu_le' => now()->toIso8601String()];

        if ($lu['lu']) {
            Cache::put($cle, $lu, self::CACHE_SECONDES);
        }

        return $lu;
    }
}
