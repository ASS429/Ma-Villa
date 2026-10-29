<?php

use App\Models\User;
use App\Models\Villa;
use App\Services\ImportCleDor;
use App\Services\Majoration;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

/**
 * Les annonces de Clé d'Or passent dans le circuit des associés.
 *
 * Décidé par l'exploitant le 29 octobre 2026 : leur prix (50 000 F) devient
 * le prix affiché majoré de notre part (57 000 F), et l'argent va au gérant
 * hébergement, qui règle Clé d'Or. Toutes les annonces du compte, y compris
 * une retirée : si elle revient, elle reviendra au bon prix.
 *
 * Par migration et non en rejouant l'import (qui ne se rejoue jamais), et
 * sans jamais arrêter l'API : une erreur est journalisée. `Majoration`
 * refuse de majorer deux fois.
 */
return new class extends Migration
{
    public function up(): void
    {
        try {
            $compte = User::where('email', ImportCleDor::EMAIL)->first();
            if (! $compte) {
                return;
            }

            $majorees = Villa::where('user_id', $compte->id)->get()
                ->filter(fn (Villa $v) => Majoration::appliquer($v))
                ->count();

            Log::info("Clé d'Or : {$majorees} annonces passées dans le circuit des associés.");
        } catch (\Throwable $e) {
            Log::error("Clé d'Or : majoration non appliquée", ['erreur' => $e->getMessage()]);
        }
    }

    public function down(): void
    {
        // Rien : redescendre les prix se décide, et se fait dans la console.
    }
};
