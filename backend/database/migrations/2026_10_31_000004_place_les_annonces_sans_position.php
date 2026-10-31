<?php

use App\Services\PositionApprochee;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Le 31 octobre 2026, 6 annonces sur 57 avaient des coordonnées : la carte
 * des résultats était presque toujours vide. Sur décision de l'exploitant,
 * les autres sont placées au centre de leur quartier, et le disent.
 *
 * Après l'import de la villa de Saly (000003), qui est donc placée aussi.
 * Voir `App\Services\PositionApprochee`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('villas', function (Blueprint $table) {
            $table->boolean('position_approximative')->default(false)->after('longitude');
        });

        // Une donnée, pas une structure : son échec ne doit pas arrêter l'API.
        try {
            Log::info('Annonces placées au centre de leur quartier', ['nombre' => PositionApprochee::placerCelles()]);
        } catch (\Throwable $e) {
            Log::error('Placement approximatif des annonces échoué', ['erreur' => $e->getMessage()]);
        }
    }

    public function down(): void
    {
        Schema::table('villas', function (Blueprint $table) {
            $table->dropColumn('position_approximative');
        });
    }
};
