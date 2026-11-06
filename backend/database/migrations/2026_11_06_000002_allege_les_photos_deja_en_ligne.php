<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;

/**
 * Allège une fois les photos déjà en ligne (accord de l'exploitant, 6 novembre 2026).
 *
 * 25 photos de 8 annonces pesaient 33 Mo, la moitié du site : l'envoi ne plafonnait
 * que la largeur, et les portraits passaient tels quels. L'envoi est corrigé
 * (`ReductionImage`) ; ceci reprend ce qui était déjà publié, même adresse, original
 * gardé sous `originaux/`.
 *
 * Ni le schéma ni la base ne changent : hors transaction, et rien ici ne doit
 * empêcher le serveur de démarrer (`start.sh` a `set -e`). La commande s'arrête
 * d'elle-même après deux minutes ; ce qui reste se reprend à la main.
 */
return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        // La production seulement, sur son stockage objet : en local, le disque « public »
        // porte des photos de travail qu'on ne retouche pas sans le demander.
        if (! app()->environment('production') || in_array(config('filesystems.media'), ['local', 'public'], true)) {
            return;
        }

        try {
            Artisan::call('passetemps:alleger-photos', ['--appliquer' => true, '--duree-max' => 120]);
            Log::info('Photos allégées au démarrage', ['sortie' => mb_substr(Artisan::output(), -2000)]);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    public function down(): void
    {
        // Les originaux restent sous `originaux/` : rien à défaire ici.
    }
};
