<?php

use App\Services\ImportLot;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

/**
 * Les trois hébergements de Jule mis de côté au premier import du
 * 31 octobre 2026, précisés par l'exploitant le même jour.
 *
 * Mêmes règles que le premier lot : rien ici n'arrête l'API ; sautée dans
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
            $bilan = (new ImportLot('database/donnees/lot-31-octobre-suite'))->executer();
            Log::info('Import de la suite du lot du 31 octobre', $bilan ?? ['deja_fait' => true]);
        } catch (\Throwable $e) {
            Log::error('Import de la suite du lot du 31 octobre échoué', ['erreur' => $e->getMessage()]);
        }
    }

    public function down(): void
    {
        // Rien : retirer une annonce se fait dans la console, motif à l'appui.
    }
};
