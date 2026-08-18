<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Categorie;
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
            // Version déployée, en clair. Sans elle, « mon correctif est-il en
            // ligne ? » ne se répond qu'en devinant : on relit du code qui n'est
            // peut-être pas celui qui tourne. Le dépôt étant public, un identifiant
            // de commit n'apprend rien à personne.
            'version' => config('app.version'),
            // Les catégories viennent de la base : ajouter « studio meublé »
            // ne doit pas demander de redéployer le front.
            'categories' => Categorie::actives()
                ->get(['cle', 'nom', 'nom_pluriel', 'unite_prix', 'formules', 'filtres']),
            'paiement' => [
                'actif'  => (bool) config('paiement.actif'),
                'moyens' => config('paiement.moyens'),
                // Le prestataire refuse en dessous : l'interface doit le savoir
                // pour ne pas proposer un règlement voué à l'échec.
                'montant_minimum' => (int) config('paiement.montant_minimum'),
            ],
        ]);
    }
}
