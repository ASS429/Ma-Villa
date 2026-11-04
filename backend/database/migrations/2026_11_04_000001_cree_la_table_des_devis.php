<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Les devis, jusqu'ici faits à la main. Le montant de chaque ligne et le total
 * sont calculés au serveur ; `cle` ouvre le PDF sans compte, pour qu'un client
 * le télécharge ou le transfère.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('devis', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 30)->unique();
            $table->string('origine', 10);
            $table->unsignedSmallInteger('annee');
            $table->unsignedInteger('rang');
            $table->string('cle', 64)->unique();
            $table->string('statut', 12)->default('emis');

            $table->foreignId('villa_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('logement_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('tarif_id')->nullable()->constrained()->nullOnDelete();

            $table->string('titre', 160);
            $table->string('client_nom', 160);
            $table->string('occupant_nom', 160)->nullable();
            $table->string('client_telephone', 40)->nullable();
            $table->string('client_email', 160)->nullable();

            $table->date('date_arrivee')->nullable();
            $table->date('date_depart')->nullable();
            $table->unsignedSmallInteger('personnes')->nullable();

            $table->json('lignes');
            $table->unsignedBigInteger('total');
            $table->date('date_emission');
            $table->date('valable_jusqu_au')->nullable();
            $table->text('conditions')->nullable();
            $table->boolean('cachet')->default(false);
            $table->string('langue', 2)->default('fr');

            $table->foreignId('cree_par')->nullable()->constrained('users')->nullOnDelete();
            // Un devis demandé en ligne : l'équipe l'a-t-elle repris ?
            $table->timestamp('suivi_le')->nullable();
            $table->timestamps();

            $table->unique(['origine', 'annee', 'rang']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devis');
    }
};
