<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Quand un client renonce, le barème lui rend une partie de la part du propriétaire.
 * Le reste revient au propriétaire (décision de l'exploitant du 5 novembre 2026), mais la
 * réservation annulée sortait du reversement : cet argent ne figurait plus nulle part.
 *
 * `montant_proprietaire` reçoit ce qui lui reste, pour que tout ce qui additionne cette
 * colonne (reversement, « Ce qui attend », pilotage, revenus) reste juste sans changement.
 * `part_avant_remboursement` garde la part d'origine : un second remboursement doit
 * repartir d'elle, et sa présence dit qu'une décision a été prise.
 * `rendu_au_client` sert au circuit des associés, qui reçoivent tout sauf notre part.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('paiements', function (Blueprint $table) {
            $table->decimal('part_avant_remboursement', 10, 2)->nullable();
            $table->decimal('rendu_au_client', 10, 2)->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('paiements', function (Blueprint $table) {
            $table->dropColumn(['part_avant_remboursement', 'rendu_au_client']);
        });
    }
};
