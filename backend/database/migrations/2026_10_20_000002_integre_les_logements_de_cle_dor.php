<?php

use App\Models\Photo;
use App\Models\User;
use App\Models\Villa;
use App\Services\ImportCleDor;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

/**
 * Les logements meublés de Clé d'Or Immobilier et Services — huit annonces,
 * douze logements — intégrés le 20 octobre 2026 à la demande de l'exploitant.
 *
 * Par migration, parce que c'est le seul geste que la production joue seule :
 * `start.sh` lance `migrate --force` à chaque démarrage, et une migration ne se
 * joue qu'une fois. Le travail lui-même est dans `App\Services\ImportCleDor`,
 * qui sait aussi ne rien refaire si le compte existe déjà.
 *
 * ⚠️ Rien ici ne doit empêcher l'API de démarrer (`set -e` dans `start.sh`) :
 * une erreur est journalisée, pas relancée. Une annonce absente se rattrape ;
 * une API à terre pendant les JOJ, non.
 *
 * Sautée dans les tests : chaque test repart d'une base neuve, et des annonces
 * qu'il n'a pas créées fausseraient ses comptes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        try {
            $bilan = app(ImportCleDor::class)->executer();
            Log::info('Import Clé d\'Or', $bilan ?? ['deja_fait' => true]);
        } catch (\Throwable $e) {
            Log::error('Import Clé d\'Or échoué', ['erreur' => $e->getMessage()]);
        }
    }

    /**
     * Retire les annonces et le compte. Les photos restent dans le stockage :
     * les effacer d'ici supposerait de retrouver chaque objet, pour un gain nul.
     */
    public function down(): void
    {
        $proprietaire = User::where('email', ImportCleDor::EMAIL)->first();
        if (! $proprietaire) {
            return;
        }

        $villas = Villa::where('user_id', $proprietaire->id)->pluck('id');
        Photo::where('photoable_type', Villa::class)->whereIn('photoable_id', $villas)->delete();
        Villa::whereIn('id', $villas)->get()->each->delete();
        $proprietaire->delete();
    }
};
