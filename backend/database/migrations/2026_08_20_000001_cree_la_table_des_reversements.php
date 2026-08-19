<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reversements aux propriétaires.
 *
 * Tout l'argent du client arrive sur le compte PayDunya de la plateforme. La
 * part du propriétaire était calculée et enregistrée à l'encaissement — mais
 * rien ne disait si elle lui avait été versée. Ni lui ni l'administrateur ne
 * pouvaient répondre à « où en est mon argent ? » autrement qu'en fouillant un
 * historique de virements hors de l'application.
 *
 * Le versement reste un geste humain : cette table ne déplace pas de fonds,
 * elle **enregistre** qu'ils l'ont été. C'est volontaire — le décaissement
 * automatique demande une activation PayDunya qui n'est pas acquise, et rien
 * n'oblige à attendre cette réponse pour savoir ce qu'on doit.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reversements', function (Blueprint $table) {
            $table->id();

            // Le bénéficiaire est relié **et** recopié, comme dans le journal
            // d'audit : un compte supprimé ne doit pas effacer la trace d'un
            // versement. Une écriture comptable qui disparaît avec son
            // destinataire ne prouve rien le jour d'un litige.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('beneficiaire_nom');
            $table->string('beneficiaire_telephone')->nullable();

            // Le montant est figé ici, jamais recalculé à la lecture : il doit
            // continuer de dire ce qui est réellement parti, même si le barème
            // de commission change ensuite.
            $table->decimal('montant', 12, 2);

            $table->enum('methode', ['wave', 'orange_money', 'virement', 'especes']);
            $table->string('reference')->nullable();
            $table->text('note')->nullable();

            $table->timestamp('verse_le');

            // L'auteur du versement, recopié pour la même raison.
            $table->foreignId('cree_par')->nullable()->constrained('users')->nullOnDelete();
            $table->string('createur_nom')->nullable();

            $table->timestamps();

            $table->index(['user_id', 'verse_le']);
        });

        Schema::table('paiements', function (Blueprint $table) {
            // Un paiement appartient à au plus un reversement. Nul tant que la
            // part du propriétaire ne lui a pas été versée : c'est exactement
            // ce qui distingue « dû » de « réglé », sans table de liaison.
            $table->foreignId('reversement_id')->nullable()->after('paye_le')
                  ->constrained('reversements')->nullOnDelete();

            // Tout calcul part de « les paiements aboutis que je n'ai pas
            // encore reversés ».
            $table->index(['statut', 'reversement_id']);
        });
    }

    public function down(): void
    {
        Schema::table('paiements', function (Blueprint $table) {
            $table->dropIndex(['statut', 'reversement_id']);
            $table->dropConstrainedForeignId('reversement_id');
        });

        Schema::dropIfExists('reversements');
    }
};
