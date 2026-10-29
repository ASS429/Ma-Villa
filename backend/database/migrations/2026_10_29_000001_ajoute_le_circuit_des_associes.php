<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Le circuit des associés, pendant les JOJ (voir `config/paiement.php`).
 *
 * Sur l'annonce : sa majoration (le prix affiché comprend notre part) et son
 * circuit. Sur le paiement : le circuit **figé au moment du paiement**, comme
 * la répartition — remettre l'annonce en direct après les Jeux ne doit pas
 * faire réapparaître comme dû au propriétaire ce qui a déjà été transmis aux
 * associés. Et la trace de la transmission, faite à la main chez PayDunya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('villas', function (Blueprint $table) {
            $table->decimal('majoration', 5, 4)->nullable()->after('vedette');
            $table->string('circuit', 16)->default('direct')->after('majoration');
        });

        Schema::table('paiements', function (Blueprint $table) {
            $table->string('circuit', 16)->default('direct')->after('taux_commission');
            $table->decimal('part_passetemps', 12, 2)->nullable()->after('circuit');
            $table->timestamp('transmis_le')->nullable()->after('part_passetemps');
            $table->decimal('transmis_montant', 12, 2)->nullable()->after('transmis_le');
            $table->string('transmis_reference', 120)->nullable()->after('transmis_montant');
            $table->string('transmis_par', 120)->nullable()->after('transmis_reference');
        });
    }

    public function down(): void
    {
        Schema::table('paiements', function (Blueprint $table) {
            $table->dropColumn([
                'circuit', 'part_passetemps', 'transmis_le', 'transmis_montant',
                'transmis_reference', 'transmis_par',
            ]);
        });

        Schema::table('villas', function (Blueprint $table) {
            $table->dropColumn(['majoration', 'circuit']);
        });
    }
};
