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

            $table->enum('methode', ['wave', 'orange_money', 'free_money', 'virement', 'especes']);
            $table->string('reference')->nullable();
            $table->text('note')->nullable();

            /*
             | Un reversement est une **opération**, pas seulement une écriture.
             |
             | `manuel` constate un virement déjà fait hors de l'application :
             | il est réussi par construction, et c'est le seul chemin tant que
             | PayDunya n'a pas ouvert le déboursement sur le compte marchand.
             |
             | Les trois autres appartiennent au déboursement automatique, qui
             | peut rester en cours — voire échouer. Un versement qui échoue
             | doit rendre ses paiements à la file, sans quoi le propriétaire
             | attendrait un argent que plus rien ne réclame.
             */
            $table->enum('statut', ['manuel', 'en_cours', 'reussi', 'echoue'])->default('manuel');

            // Jeton PayDunya : il identifie la transaction pour toute sa vie,
            // et c'est avec lui seul qu'on peut relire son statut réel.
            $table->string('disburse_token')->nullable();

            // Notre propre référence, envoyée comme `disburse_id`. PayDunya
            // refuse de la rejouer : c'est le garde-fou contre un second
            // virement si la requête est relancée après une panne réseau.
            $table->string('disburse_id')->nullable()->unique();

            $table->string('transaction_id')->nullable();
            $table->string('provider_ref')->nullable();

            $table->text('echec_motif')->nullable();
            $table->json('reponse_prestataire')->nullable();

            // Nulle tant que l'argent n'est pas parti : un versement en cours
            // n'a pas de date de versement, et prétendre le contraire ferait
            // figurer comme payé ce qui ne l'est pas encore.
            $table->timestamp('verse_le')->nullable();

            // L'auteur du versement, recopié pour la même raison.
            $table->foreignId('cree_par')->nullable()->constrained('users')->nullOnDelete();
            $table->string('createur_nom')->nullable();

            $table->timestamps();

            $table->index(['user_id', 'verse_le']);

            // Le suivi des déboursements part de « ceux qui traînent ».
            $table->index(['statut', 'created_at']);
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
