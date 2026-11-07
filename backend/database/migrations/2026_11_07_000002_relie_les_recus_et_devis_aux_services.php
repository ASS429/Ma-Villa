<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Un trajet a son devis et son reçu, comme un séjour (accord de l'exploitant,
 * 7 novembre 2026).
 *
 * Le reçu d'un trajet est un règlement comme les autres : même suite de numéros
 * (RC-2026-…), même registre, même export pour le comptable. Il est rattaché à la
 * demande, pas à un devis, parce qu'un trajet ne bloque ni dates ni logement.
 * Le devis d'un trajet est un devis ordinaire, qui garde la demande dont il vient.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reglements', function (Blueprint $table) {
            $table->foreignId('demande_service_id')->nullable()->constrained('demandes_service')->nullOnDelete();
        });

        Schema::table('devis', function (Blueprint $table) {
            $table->foreignId('demande_service_id')->nullable()->constrained('demandes_service')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('devis', function (Blueprint $table) {
            $table->dropConstrainedForeignId('demande_service_id');
        });

        Schema::table('reglements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('demande_service_id');
        });
    }
};
