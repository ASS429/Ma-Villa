<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Deux ajouts du 5 novembre 2026.
 *
 * `devis.deleted_at` : supprimer un devis efface le client mais garde la ligne.
 * Le rang suivant se lit sur le plus grand existant : retirer la dernière ligne
 * redonnerait son numéro à un autre client, alors que l'ancien PDF circule
 * peut-être encore. Voir `Devis::effacer()`.
 *
 * `devis_refuses` : ce que le site n'a pas pu établir. Aucune donnée personnelle
 * ici, volontairement : ni nom, ni numéro, ni adresse IP. Une ligne dit qu'une
 * demande n'a pas pu être servie, et pourquoi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('devis', function (Blueprint $table) {
            $table->softDeletes();
        });

        Schema::create('devis_refuses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('villa_id')->nullable()->constrained('villas')->nullOnDelete();
            $table->foreignId('logement_id')->nullable()->constrained('logements')->nullOnDelete();
            $table->string('motif', 20);
            $table->date('date_debut')->nullable();
            $table->date('date_fin')->nullable();
            $table->unsignedSmallInteger('personnes')->nullable();
            $table->string('langue', 2)->default('fr');
            $table->timestamp('created_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devis_refuses');

        Schema::table('devis', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
