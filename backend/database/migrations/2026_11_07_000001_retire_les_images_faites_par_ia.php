<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Retire des annonces les huit images faites par ChatGPT (décision de l'exploitant,
 * 7 novembre 2026).
 *
 * Leur manifeste C2PA les dit « créées par gpt-image » (trainedAlgorithmicMedia) :
 * montrées comme la photo d'un logement, elles peuvent tromper le client. Annonce 53
 * « Studio meublé » (4 sur 5), 54 « Villa Amar » (1 sur 3), 64 « Chambre meublée »
 * (3 sur 5).
 *
 * Une ligne ne part que si son identifiant **et** son fichier concordent : en local, ou
 * si la base diffère, rien n'est touché. Les fichiers restent sur le stockage, et chaque
 * ligne retirée est écrite au journal : on peut la remettre.
 */
return new class extends Migration
{
    private const IMAGES = [
        186 => 'HpoIrTrawkkTeHHACgOa7y4Eh0ViXxlOHuNYVBWK.jpg',
        187 => 'A4yDReoS5EBl6NCjIllrbw8ybk69fZGuzJsOmj9g.jpg',
        188 => 'QenuecK4PHm04XPoYDNWcUImxlMza6iPE2wFycbs.jpg',
        190 => '46pL7HQaXSiHKO0JIIrVb0OgEySZXTQ0erbZpvuQ.jpg',
        191 => 'UrLNyHbwwXyFIInrhmLzHxB5CIg6mxPikmoRuhNI.jpg',
        237 => 'EIqxf74yuwf57189WDAuGC16zTOHJwLdfmt7XouG.jpg',
        238 => 'Oj9HftDrfqyRnLnrI6fPAtcYhhnCDGcTCW6luYvB.jpg',
        240 => 'fXBLQJ0wefSTSgkyWHZAUzEY9oShtpgQQwRpgj6O.jpg',
    ];

    public function up(): void
    {
        foreach (self::IMAGES as $id => $fichier) {
            $ligne = DB::table('photos')->where('id', $id)->where('url', 'like', '%/'.$fichier)->first();
            if (! $ligne) {
                continue;
            }

            Log::info('Image faite par IA retirée d’une annonce', (array) $ligne);
            DB::table('photos')->where('id', $id)->delete();
        }
    }

    public function down(): void
    {
        // Les lignes retirées sont au journal, les fichiers sur le stockage : à remettre à la main.
    }
};
