<?php

use App\Services\ImportLot;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

/**
 * Neuf hébergements à Saly, Ngaparou, Ouest Foire, Virage et aux Almadies,
 * pour trois propriétaires, dans le circuit des associés (31 octobre 2026).
 *
 * Mêmes règles que Clé d'Or et Virage : par migration parce que c'est le seul
 * geste que la production joue seule ; rien ici n'arrête l'API ; sautée dans
 * les tests, qui appellent `ImportLot` directement.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        try {
            $bilan = (new ImportLot('database/donnees/lot-31-octobre'))->executer();
            Log::info('Import du lot du 31 octobre', $bilan ?? ['deja_fait' => true]);
        } catch (\Throwable $e) {
            Log::error('Import du lot du 31 octobre échoué', ['erreur' => $e->getMessage()]);
        }
    }

    public function down(): void
    {
        // Rien : retirer une annonce se fait dans la console, motif à l'appui.
    }
};
