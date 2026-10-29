<?php

use App\Services\ImportVirage;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

/**
 * Neuf logements à Virage et aux Almadies, rattachés au compte de leur
 * propriétaire, dans le circuit des associés (29 octobre 2026).
 *
 * Mêmes règles que l'import de Clé d'Or : par migration parce que c'est le
 * seul geste que la production joue seule ; rien ici n'arrête l'API ;
 * sautée dans les tests, qui appellent `ImportVirage` directement.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        try {
            $bilan = app(ImportVirage::class)->executer();
            Log::info('Import Virage', $bilan ?? ['deja_fait' => true]);
        } catch (\Throwable $e) {
            Log::error('Import Virage échoué', ['erreur' => $e->getMessage()]);
        }
    }

    public function down(): void
    {
        // Rien : retirer une annonce se fait dans la console, motif à l'appui.
    }
};
