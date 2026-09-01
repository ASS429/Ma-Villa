<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Vide la vitrine de ce qui n'est pas à vendre.
 *
 * Le paiement est ouvert en argent réel. Or les vingt-deux annonces publiques
 * sont des données de démonstration, indiscernables d'une vraie annonce : nom
 * plausible, photos, avis, tarifs, propriétaire. **Un visiteur peut payer un
 * séjour qui n'existe pas** — et deux villas de test traînent en plus, dont
 * une à 500 FCFA, assez peu chère pour qu'on l'achète par curiosité.
 *
 * Elles passent en **brouillon**, pas à la corbeille. Un brouillon disparaît
 * du public et de la file de modération tout en gardant ses photos, ses
 * tarifs et ses réservations : la décision se défait en une requête, et rien
 * de ce qui a servi à mettre le produit au point n'est perdu.
 *
 * ⚠️ Une migration plutôt qu'une commande à lancer : c'est le seul mécanisme
 * qui s'exécute de lui-même au déploiement, et il laisse une trace datée de
 * ce qui a été fait.
 */
return new class extends Migration
{
    /**
     * Les trois propriétaires créés par le peuplement.
     *
     * C'est le marqueur fiable : le nom d'une annonce peut changer, son auteur
     * non. Une vraie annonce déposée par un vrai propriétaire n'est jamais
     * touchée, quel que soit son intitulé.
     */
    private const COMPTES_DE_DEMONSTRATION = [
        'amadou.diallo@mavilla.sn',
        'fatou.ndiaye@mavilla.sn',
        'ibrahima.fall@mavilla.sn',
    ];

    /**
     * Les essais laissés en chemin, reconnaissables seulement à leur nom :
     * ils appartiennent à un compte réel, pas au peuplement.
     */
    private const ESSAIS = [
        'villa test paiement',
        'Sejour à Dakar',
    ];

    public function up(): void
    {
        $demonstration = DB::table('villas')
            ->join('users', 'users.id', '=', 'villas.user_id')
            ->whereIn('users.email', self::COMPTES_DE_DEMONSTRATION)
            ->where('villas.statut', '!=', 'brouillon')
            ->pluck('villas.id');

        $essais = DB::table('villas')
            ->whereIn('nom', self::ESSAIS)
            ->where('statut', '!=', 'brouillon')
            ->pluck('id');

        $tout = $demonstration->merge($essais)->unique();

        if ($tout->isEmpty()) {
            return;
        }

        // `updated_at` est posé explicitement : le constructeur de requêtes ne
        // touche pas aux horodatages, et on veut pouvoir dater le retrait.
        DB::table('villas')
            ->whereIn('id', $tout)
            ->update(['statut' => 'brouillon', 'updated_at' => now()]);

        // La mise en vedette n'a plus de sens sur une annonce retirée : elle
        // survivrait au retour en ligne et remonterait une annonce que
        // personne n'a revue.
        DB::table('villas')->whereIn('id', $tout)->update(['vedette' => false]);
    }

    /**
     * Le retour en arrière republie, et c'est volontaire.
     *
     * Il ne remet pas la vedette : elle se repose à la main, annonce par
     * annonce, ce qui est précisément le geste qu'on veut conscient.
     */
    public function down(): void
    {
        DB::table('villas')
            ->join('users', 'users.id', '=', 'villas.user_id')
            ->whereIn('users.email', self::COMPTES_DE_DEMONSTRATION)
            ->where('villas.statut', 'brouillon')
            ->update(['villas.statut' => 'validee', 'villas.updated_at' => now()]);

        DB::table('villas')
            ->whereIn('nom', self::ESSAIS)
            ->where('statut', 'brouillon')
            ->update(['statut' => 'validee', 'updated_at' => now()]);
    }
};
