<?php

namespace App\Console\Commands;

use App\Models\Photo;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Déplace les médias du disque local vers le stockage objet et réécrit les URL
 * enregistrées en base.
 *
 * À lancer une fois, après avoir renseigné les identifiants du bucket et
 * basculé MEDIA_DISK. Sans cela, les photos déjà en ligne continueraient de
 * pointer vers le disque du conteneur, qui est réinitialisé à chaque
 * déploiement.
 */
class MigrerMedias extends Command
{
    protected $signature = 'passetemps:migrer-medias
                            {--source=public : disque de départ}
                            {--simulation : affiche ce qui serait fait, sans rien écrire}';

    protected $description = 'Transfère les photos vers le stockage objet et met à jour leurs URL';

    public function handle(): int
    {
        $source = $this->option('source');
        $cible = config('filesystems.media');
        $simulation = $this->option('simulation');

        if ($source === $cible) {
            $this->error("Le disque cible ({$cible}) est identique au disque source.");
            $this->line('Renseignez MEDIA_DISK avant de lancer cette commande.');

            return self::FAILURE;
        }

        $this->info("Transfert : {$source} → {$cible}".($simulation ? ' (simulation)' : ''));

        $transferees = 0;
        $ignorees = 0;
        $echecs = 0;

        Photo::query()->orderBy('id')->chunkById(100, function ($photos) use (
            $source, $cible, $simulation, &$transferees, &$ignorees, &$echecs
        ) {
            foreach ($photos as $photo) {
                $chemin = $this->cheminDepuisUrl($photo->url);

                if ($chemin === null) {
                    // URL externe ou déjà migrée : on n'y touche pas.
                    $ignorees++;
                    continue;
                }

                if (! Storage::disk($source)->exists($chemin)) {
                    $this->warn("  introuvable : {$chemin} (photo #{$photo->id})");
                    $echecs++;
                    continue;
                }

                if ($simulation) {
                    $this->line("  transférerait {$chemin}");
                    $transferees++;
                    continue;
                }

                try {
                    Storage::disk($cible)->put(
                        $chemin,
                        Storage::disk($source)->get($chemin),
                        'public'
                    );

                    $url = Storage::disk($cible)->url($chemin);
                    $photo->update(['url' => str_starts_with($url, 'http') ? $url : url($url)]);
                    $transferees++;
                } catch (\Throwable $e) {
                    $this->error("  échec sur {$chemin} : {$e->getMessage()}");
                    $echecs++;
                }
            }
        });

        $this->newLine();
        $this->info("Transférées : {$transferees} · ignorées : {$ignorees} · échecs : {$echecs}");

        if ($echecs > 0) {
            $this->warn('Des fichiers manquent. Les originaux ne sont pas supprimés : relancez après correction.');
        }

        return $echecs > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Extrait `uploads/xxx.jpg` d'une URL servie par le disque local.
     * Renvoie null si l'URL ne vient pas de ce disque.
     */
    private function cheminDepuisUrl(string $url): ?string
    {
        if (! preg_match('#/storage/(uploads/.+)$#', $url, $m)) {
            return null;
        }

        return $m[1];
    }
}
