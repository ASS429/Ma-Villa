<?php

use App\Services\ImportVirage;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

/**
 * Ce que l'exploitant a précisé le 30 octobre 2026 sur les logements de
 * Virage : AP3 est un logement à part, publié ; l'immeuble d'AP8 a piscine
 * et salle de sport, montrées sur l'annonce.
 *
 * Mêmes règles que l'import : rien ici n'arrête l'API ; sautée dans les
 * tests, qui appellent `ImportVirage::completer` directement.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        try {
            Log::info('Virage complété', app(ImportVirage::class)->completer());
        } catch (\Throwable $e) {
            Log::error('Virage non complété', ['erreur' => $e->getMessage()]);
        }
    }

    public function down(): void
    {
        // Rien : retirer une annonce se fait dans la console, motif à l'appui.
    }
};
