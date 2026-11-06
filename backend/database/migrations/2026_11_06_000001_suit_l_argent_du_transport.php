<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * L'argent d'un service : PasseTemps encaisse et reverse au transporteur
 * (décision de l'exploitant, 6 novembre 2026).
 *
 * Sur la demande elle-même, parce qu'un trajet se paie en une fois : ce qui a
 * été reçu, la part du prestataire figée à ce moment-là (le prix confirmé au
 * client peut différer du prix affiché), puis le jour où elle lui a été
 * reversée. Tant qu'elle ne l'est pas, elle n'est pas à nous.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('demandes_service', function (Blueprint $table) {
            $table->unsignedInteger('montant_encaisse')->nullable();
            $table->unsignedInteger('part_prestataire')->nullable();
            $table->string('prestataire', 80)->nullable();
            $table->string('moyen_encaissement', 20)->nullable();
            $table->string('reference_encaissement', 80)->nullable();
            $table->date('encaisse_le')->nullable();
            $table->foreignId('encaisse_par')->nullable()->constrained('users')->nullOnDelete();
            $table->date('reverse_le')->nullable();
            $table->string('reference_reversement', 80)->nullable();
            $table->foreignId('reverse_par')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('demandes_service', function (Blueprint $table) {
            $table->dropConstrainedForeignId('encaisse_par');
            $table->dropConstrainedForeignId('reverse_par');
            $table->dropColumn([
                'montant_encaisse', 'part_prestataire', 'prestataire', 'moyen_encaissement',
                'reference_encaissement', 'encaisse_le', 'reverse_le', 'reference_reversement',
            ]);
        });
    }
};
