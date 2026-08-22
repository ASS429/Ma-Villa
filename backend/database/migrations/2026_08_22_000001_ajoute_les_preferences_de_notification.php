<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Préférences de notification, par sujet et par canal.
 *
 * En JSON et non en table : ce sont cinq lignes par compte, toujours lues d'un
 * bloc et jamais interrogées séparément. Une table imposerait une jointure à
 * chaque envoi pour retrouver une préférence qu'on lit intégralement.
 *
 * Nul par défaut, et c'est voulu : un compte sans préférence enregistrée suit
 * le barème de `config/notifications.php`. Écrire les valeurs par défaut en
 * base les figerait au jour de l'inscription, et changer un défaut ne toucherait
 * plus personne.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('preferences_notification')->nullable()->after('role');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('preferences_notification');
        });
    }
};
