<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Deux ajouts que le catalogue réel a rendus nécessaires.
 *
 * **La catégorie.** Une boutique de dix-neuf articles se parcourt d'un coup
 * d'œil ; à cent, on cherche. Et on ne cherche pas un bracelet comme on cherche
 * un boubou. La catégorie vient de la configuration et non d'une table, à la
 * différence des catégories de logement : celles-ci portent des règles métier
 * (unité de prix, formules autorisées, filtres), alors qu'ici elle ne sert qu'à
 * ranger — lui donner une table serait payer une jointure pour un libellé.
 *
 * **Le stock.** Le premier catalogue supposait des pièces uniques : commander
 * retirait l'œuvre de la vitrine. Les articles fournis sont pour la plupart des
 * bracelets, des sandales, des chemises — reproductibles, vendus en série.
 * Sans quantité, commander un bracelet aurait fait disparaître les bracelets.
 *
 * `stock` vaut 1 par défaut : une toile ou une sculpture garde exactement le
 * comportement d'avant, et c'est bien ce qu'on veut pour elles.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('oeuvres', function (Blueprint $table) {
            $table->string('categorie')->default('objets')->after('artiste');

            // Petit entier : personne ne tient dix mille exemplaires d'un
            // article fait main, et le type dit la vérité sur l'ordre de
            // grandeur attendu.
            $table->unsignedSmallInteger('stock')->default(1)->after('prix');

            // Toute vitrine part de « les articles publiés d'une catégorie ».
            $table->index(['statut', 'categorie']);
        });
    }

    public function down(): void
    {
        Schema::table('oeuvres', function (Blueprint $table) {
            $table->dropIndex(['statut', 'categorie']);
            $table->dropColumn(['categorie', 'stock']);
        });
    }
};
