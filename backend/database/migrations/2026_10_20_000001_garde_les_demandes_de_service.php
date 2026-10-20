<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Les demandes de service des voyageurs — transport et repas.
 *
 * La demande part sur WhatsApp, et c'est là qu'on y répond. On la garde aussi
 * ici, pour une seule raison : **un message WhatsApp peut ne jamais partir.**
 * Le visiteur remplit le formulaire, WhatsApp s'ouvre, il est interrompu, et
 * personne n'apprend qu'une famille attend un chauffeur à l'aéroport. La ligne
 * de « Ce qui attend » la rattrape.
 *
 * Aucune colonne de montant : rien n'est encaissé, et un prix recopié ici
 * passerait pour un engagement. Le prix indicatif vit dans la configuration.
 *
 * `prestation` est une clé de `config/prestations.php`, pas une clé étrangère :
 * le catalogue n'est pas en base, et une demande ancienne doit rester lisible
 * même si sa prestation disparaît du catalogue — l'écran affiche alors la clé.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('demandes_service', function (Blueprint $table) {
            $table->id();
            // Facultatif : une famille qui arrive de l'étranger ne se crée pas
            // de compte pour demander un chauffeur.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $table->string('prestation', 40);
            $table->date('date_service');
            $table->string('heure', 5)->nullable();
            $table->unsignedSmallInteger('personnes');
            $table->string('lieu', 160);
            $table->string('vol', 20)->nullable();
            $table->string('delegation', 80)->nullable();

            $table->string('nom', 80);
            $table->string('telephone', 30);
            $table->string('email', 120)->nullable();
            $table->text('message')->nullable();
            $table->string('langue', 2)->default('fr');
            // La page d'où elle part : un service, ou la vitrine des JOJ.
            $table->string('origine', 20)->nullable();

            $table->string('statut', 20)->default('nouvelle');
            $table->timestamp('traitee_le')->nullable();
            $table->foreignId('traitee_par')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->index(['statut', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('demandes_service');
    }
};
