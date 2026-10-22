<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La position du demandeur, quand il choisit de la donner (« Utiliser ma
 * position actuelle ») : le chauffeur sait où le prendre sans deviner une
 * adresse. Facultative, et jamais demandée sans un geste du visiteur.
 *
 * Six décimales : une dizaine de centimètres, bien plus fin que ce que donne
 * un téléphone. La précision annoncée par le téléphone est gardée avec, pour
 * qu'on sache s'il faut rappeler la famille avant de partir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('demandes_service', function (Blueprint $table) {
            $table->decimal('latitude', 9, 6)->nullable()->after('lieu');
            $table->decimal('longitude', 9, 6)->nullable()->after('latitude');
            $table->unsignedInteger('precision_m')->nullable()->after('longitude');
        });
    }

    public function down(): void
    {
        Schema::table('demandes_service', function (Blueprint $table) {
            $table->dropColumn(['latitude', 'longitude', 'precision_m']);
        });
    }
};
