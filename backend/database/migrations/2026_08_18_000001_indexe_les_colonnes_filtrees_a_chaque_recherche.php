<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `villas.statut`, `villas.ville` et `villas.vedette` sont filtrés à chaque
 * recherche et n'étaient indexés nulle part.
 *
 * Sur vingt villas c'est invisible ; sur deux mille, c'est un parcours complet
 * de la table à chaque requête. Le coût s'ajoute à celui, déjà réel, des
 * sous-requêtes corrélées qui calculent prix minimum, note et capacité.
 *
 * `(statut, vedette)` en index composé plutôt que deux index séparés : ces deux
 * colonnes sont toujours interrogées ensemble sur la page d'accueil, qui ne
 * cherche que des villas validées et mises en avant.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('villas', function (Blueprint $table) {
            $table->index(['statut', 'vedette'], 'villas_statut_vedette_index');
            $table->index('ville', 'villas_ville_index');
        });
    }

    public function down(): void
    {
        Schema::table('villas', function (Blueprint $table) {
            $table->dropIndex('villas_statut_vedette_index');
            $table->dropIndex('villas_ville_index');
        });
    }
};
