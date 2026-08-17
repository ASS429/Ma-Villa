<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Seule l'URL de la page de paiement était conservée. Le lien qui ouvre
 * directement Wave ou Orange Money ne vivait que dans la réponse à l'initiation :
 * un rechargement de l'écran d'attente, ou un retour depuis l'application, et il
 * n'y avait plus rien à proposer au payeur — ni bouton, ni code à scanner.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('paiements', function (Blueprint $table) {
            $table->string('url_application')->nullable()->after('url_paiement');
        });
    }

    public function down(): void
    {
        Schema::table('paiements', function (Blueprint $table) {
            $table->dropColumn('url_application');
        });
    }
};
