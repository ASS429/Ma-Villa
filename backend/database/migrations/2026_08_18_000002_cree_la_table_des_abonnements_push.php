<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Abonnements aux notifications poussées.
 *
 * Un abonnement appartient à un *appareil*, pas à un compte : le même
 * propriétaire reçoit ses demandes de réservation sur son téléphone et sur son
 * ordinateur, et révoquer l'un ne doit pas couper l'autre.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('abonnements_push', function (Blueprint $table) {
            $table->id();

            // Un compte supprimé emporte ses abonnements : sans cela on
            // continuerait à pousser vers un appareil dont plus personne ne
            // répond du contenu.
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // L'URL du service de poussée (FCM, Mozilla, WNS…). C'est elle qui
            // identifie l'appareil : deux abonnements du même navigateur
            // partagent la même, et le second doit remplacer le premier plutôt
            // que de le doubler.
            $table->string('endpoint', 500)->unique();

            $table->string('cle_p256dh');
            $table->string('cle_auth');

            // Le navigateur annonce parfois lui-même une péremption : la
            // connaître évite un envoi voué à l'échec.
            $table->timestamp('expire_le')->nullable();

            // De quoi laisser l'utilisateur reconnaître ses appareils dans la
            // liste — « Chrome sur Android » se distingue, un identifiant non.
            $table->string('appareil')->nullable();

            // Un service de poussée finit par refuser un abonnement mort. On
            // compte les refus pour le retirer, plutôt que de réessayer
            // indéfiniment à chaque notification.
            $table->unsignedSmallInteger('echecs')->default(0);
            $table->timestamp('derniere_poussee_le')->nullable();

            $table->timestamps();

            // Toute émission part de « les abonnements de cet utilisateur ».
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('abonnements_push');
    }
};
