<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Journal des actions d'administration.
 *
 * Rien ne gardait trace de qui avait validé une villa, supprimé un avis ou
 * fermé un compte. En cas de litige avec un propriétaire — « mon annonce a été
 * rejetée sans raison » — il n'y avait rien à produire, et aucun moyen de
 * distinguer une erreur d'un abus.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('journal_admin', function (Blueprint $table) {
            $table->id();

            // L'auteur peut être supprimé plus tard ; la trace doit survivre.
            // Un journal qui s'efface avec son auteur ne prouve rien.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('auteur_nom');
            $table->string('auteur_email');

            $table->string('action', 60);

            // Cible désignée par type et identifiant plutôt que par clé
            // étrangère : l'objet visé est souvent supprimé par l'action
            // elle-même, et la trace doit lui survivre.
            $table->string('cible_type', 40)->nullable();
            $table->unsignedBigInteger('cible_id')->nullable();
            $table->string('cible_libelle')->nullable();

            // Contexte libre : ancien et nouveau statut, motif éventuel.
            $table->json('details')->nullable();

            $table->string('ip', 45)->nullable();
            $table->timestamps();

            $table->index('action');
            $table->index(['cible_type', 'cible_id']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('journal_admin');
    }
};
