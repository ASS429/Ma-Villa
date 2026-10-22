<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Les longs séjours : un prix à la semaine et un prix au mois sur un tarif à
 * la nuitée, et une durée minimale par logement.
 *
 * Tout est facultatif : un tarif sans prix de semaine se calcule comme avant,
 * nuit par nuit, et un logement sans minimum se réserve dès une nuit. Rien de
 * ce qui est déjà publié ne change de prix.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tarifs', function (Blueprint $table) {
            $table->unsignedInteger('prix_semaine')->nullable()->after('prix');
            $table->unsignedInteger('prix_mois')->nullable()->after('prix_semaine');
        });

        Schema::table('logements', function (Blueprint $table) {
            $table->unsignedSmallInteger('nuits_minimum')->default(1)->after('capacite');
        });
    }

    public function down(): void
    {
        Schema::table('tarifs', function (Blueprint $table) {
            $table->dropColumn(['prix_semaine', 'prix_mois']);
        });

        Schema::table('logements', function (Blueprint $table) {
            $table->dropColumn('nuits_minimum');
        });
    }
};
