<?php

use App\Services\ImportLot;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

/**
 * Rejoue l'import de la villa de Saly, défait en production le 31 octobre 2026.
 *
 * La migration 000003 l'avait importée, puis `ImportLot` a voulu la placer
 * sur la carte avant que la 000004 ait créé `position_approximative`. Sous
 * Postgres, une erreur dans une transaction l'annule tout entière, même
 * rattrapée en PHP : l'import a été défait sans bruit, et Laravel a pourtant
 * noté la 000003 comme jouée — un redéploiement ne l'aurait jamais rejouée.
 *
 * Sans risque de doublon : `ImportLot` ne fait rien si la première annonce du
 * lot existe déjà (cas d'une base où la 000003 aurait réussi). La colonne
 * existe désormais : la villa est placée au centre de Saly à la fin.
 *
 * Leçon : dans une migration, un `try/catch` ne protège pas les données sous
 * Postgres ; il ne fait que masquer l'erreur. Ne pas appeler depuis une
 * migration du code qui suppose un schéma plus récent qu'elle.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        try {
            $bilan = (new ImportLot('database/donnees/lot-31-octobre-villa-saly'))->executer();
            Log::info('Import de la villa de Saly rejoué', $bilan ?? ['deja_fait' => true]);
        } catch (\Throwable $e) {
            Log::error('Import de la villa de Saly rejoué : échec', ['erreur' => $e->getMessage()]);
        }
    }

    public function down(): void
    {
        // Rien : retirer une annonce se fait dans la console, motif à l'appui.
    }
};
