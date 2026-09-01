<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Retire de la vitrine les dix-neuf articles de démonstration.
 *
 * Leurs prix et leurs artisans sont **inventés** — « Sabar traditionnel,
 * Modou Gueye, 95 000 FCFA ». Ils sont commandables et payables en argent
 * réel, et la vente à distance n'est couverte par aucun texte : ni
 * rétractation, ni retour, ni garantie.
 *
 * Comme pour les annonces, ils passent en **brouillon** : invisibles de la
 * boutique, conservés avec leurs photos pour servir de gabarit au jour où le
 * vrai catalogue sera saisi.
 *
 * ⚠️ Cette migration ne remplace pas `BOUTIQUE_ACTIVE=false`, et l'inverse est
 * vrai aussi. Elle vide la vitrine ; la variable ferme la porte. Les deux se
 * posent, parce qu'elles ne protègent pas de la même chose : un article publié
 * par mégarde reparaîtrait si seule la vitrine était vidée, et l'adresse de la
 * boutique resterait atteignable si seule la variable était oubliée.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Tout ce qui est en vitrine, sans distinguer : à ce jour aucun
        // article réel n'a été saisi, tout ce qui s'y trouve vient du
        // peuplement. Chercher à trier coûterait une liste de titres à tenir
        // à jour, pour protéger des articles qui n'existent pas.
        $ids = DB::table('oeuvres')->where('statut', '!=', 'brouillon')->pluck('id');

        if ($ids->isEmpty()) {
            return;
        }

        DB::table('oeuvres')
            ->whereIn('id', $ids)
            ->update(['statut' => 'brouillon', 'vedette' => false, 'updated_at' => now()]);
    }

    /**
     * Le retour en arrière remet en vente ce qui a du stock.
     *
     * Un article sans exemplaire ne se republie pas : « en vente » avec zéro
     * stock est une promesse qu'on ne peut pas tenir, et c'est la règle que la
     * boutique applique partout ailleurs.
     */
    public function down(): void
    {
        DB::table('oeuvres')
            ->where('statut', 'brouillon')
            ->where('stock', '>', 0)
            ->update(['statut' => 'publiee', 'updated_at' => now()]);
    }
};
