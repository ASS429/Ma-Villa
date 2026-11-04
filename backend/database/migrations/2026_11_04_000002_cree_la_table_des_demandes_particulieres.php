<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Les demandes qui ne tiennent pas dans une réservation : un anniversaire de
 * trente invités en journée, un séminaire, un groupe, un long séjour. Elles
 * arrivaient par e-mail, sans annonce ni dates rangées.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('demandes_particulieres', function (Blueprint $table) {
            $table->id();
            $table->foreignId('villa_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 20);
            $table->date('date_debut')->nullable();
            $table->date('date_fin')->nullable();
            $table->boolean('dates_a_confirmer')->default(false);
            $table->unsignedSmallInteger('personnes_sejour')->nullable();
            $table->unsignedSmallInteger('invites')->nullable();
            $table->json('besoins')->nullable();
            $table->unsignedBigInteger('budget')->nullable();
            $table->text('message');
            $table->string('nom', 120);
            $table->string('telephone', 40)->nullable();
            $table->string('email', 160)->nullable();
            $table->string('langue', 2)->default('fr');
            $table->string('statut', 12)->default('nouvelle');
            $table->timestamp('traitee_le')->nullable();
            $table->foreignId('traitee_par')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('demandes_particulieres');
    }
};
