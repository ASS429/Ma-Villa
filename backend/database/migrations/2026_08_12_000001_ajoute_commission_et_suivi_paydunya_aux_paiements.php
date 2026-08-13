<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La table `paiements` ne portait que le montant global : impossible de savoir
 * ce que la plateforme a retenu ni ce que le propriétaire doit toucher, et
 * impossible de rapprocher une ligne d'une transaction PayDunya.
 *
 * Les parts sont figées au moment du paiement plutôt que recalculées à la
 * lecture : un changement de barème ne doit jamais réécrire l'histoire
 * comptable des réservations déjà réglées.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('paiements', function (Blueprint $table) {
            $table->decimal('commission', 10, 2)->default(0)->after('montant');
            $table->decimal('montant_proprietaire', 10, 2)->default(0)->after('commission');
            $table->decimal('taux_commission', 5, 4)->default(0)->after('montant_proprietaire');

            // Jeton de facture PayDunya : c'est lui qui identifie la transaction
            // côté prestataire, `reference` restant notre propre référence.
            $table->string('token_paydunya')->nullable()->after('reference');
            $table->string('url_paiement')->nullable()->after('token_paydunya');

            // Réponse brute du prestataire, conservée pour les litiges : sans
            // elle, un paiement contesté n'a aucune trace opposable.
            $table->json('reponse_prestataire')->nullable()->after('url_paiement');
            $table->timestamp('paye_le')->nullable()->after('reponse_prestataire');

            $table->index('token_paydunya');
        });
    }

    public function down(): void
    {
        Schema::table('paiements', function (Blueprint $table) {
            $table->dropIndex(['token_paydunya']);
            $table->dropColumn([
                'commission', 'montant_proprietaire', 'taux_commission',
                'token_paydunya', 'url_paiement', 'reponse_prestataire', 'paye_le',
            ]);
        });
    }
};
