<?php

namespace App\Console\Commands;

use App\Models\Photo;
use App\Services\ReductionImage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Allège les photos déjà en ligne qui sont trop lourdes ou trop grandes.
 *
 * Jusqu'au 6 novembre 2026, l'envoi ne plafonnait que la largeur : une photo
 * de téléphone en portrait (1840 × 3264) passait telle quelle, et 25 photos de
 * 8 annonces pesaient la moitié du volume du site. L'envoi est corrigé ; cette
 * commande reprend ce qui était déjà en ligne.
 *
 * - Sans `--appliquer`, elle **simule** : elle réduit dans un fichier
 *   temporaire, dit le gain, et n'écrit rien.
 * - Avec, chaque photo garde **la même adresse** (rien à changer en base), et
 *   l'original est d'abord copié sous `originaux/` : on peut revenir en arrière.
 */
class AllegerPhotos extends Command
{
    protected $signature = 'passetemps:alleger-photos
                            {--appliquer : écrire les photos allégées (sinon, simulation)}
                            {--duree-max=0 : s’arrêter après tant de secondes (0 : sans limite)}';

    protected $description = 'Réduit les photos déjà en ligne trop lourdes, en gardant l’original de côté';

    /** En deçà, une photo ne coûte rien à personne : on ne la télécharge même pas. */
    private const POIDS_NEGLIGEABLE = 250 * 1024;

    public function handle(ReductionImage $reduction): int
    {
        $disque = Storage::disk(config('filesystems.media'));
        $appliquer = (bool) $this->option('appliquer');
        $this->info($appliquer ? 'Allègement des photos.' : 'Simulation : rien ne sera écrit. Ajoutez --appliquer pour le faire.');

        $vues = $reprises = $echecs = 0;
        $dureeMax = max(0, (int) $this->option('duree-max'));
        $debut = microtime(true);
        $interrompue = false;
        $avant = $apres = 0;
        $dejaVus = [];

        Photo::query()->orderBy('id')->chunkById(100, function ($photos) use (
            $disque, $appliquer, $reduction, &$vues, &$reprises, &$echecs, &$avant, &$apres, &$dejaVus,
            $dureeMax, $debut, &$interrompue
        ) {
            foreach ($photos as $photo) {
                // Lancée au démarrage du serveur, elle ne doit jamais le retarder au-delà du raisonnable.
                if ($dureeMax > 0 && microtime(true) - $debut > $dureeMax) {
                    $interrompue = true;

                    return false;
                }

                $chemin = $this->cheminDepuisUrl((string) $photo->url);
                // Une même image peut servir à l'annonce et à un logement : une fois suffit.
                if ($chemin === null || isset($dejaVus[$chemin])) {
                    continue;
                }
                $dejaVus[$chemin] = true;
                $vues++;

                $temporaire = tempnam(sys_get_temp_dir(), 'photo');
                try {
                    if (! $disque->exists($chemin)) {
                        $this->warn("  introuvable : {$chemin} (photo #{$photo->id})");
                        $echecs++;

                        continue;
                    }

                    // Le poids se lit sans télécharger : la plupart des photos s'arrêtent là.
                    if ($disque->size($chemin) <= self::POIDS_NEGLIGEABLE) {
                        continue;
                    }

                    $octets = $disque->get($chemin);
                    file_put_contents($temporaire, $octets);
                    $dimensions = $reduction->dimensions($temporaire);
                    $poids = strlen($octets);

                    if ($dimensions === null || (max($dimensions) <= ReductionImage::COTE_MAX && $poids <= ReductionImage::POIDS_MAX)) {
                        continue;
                    }

                    $reduction->reduire($temporaire);
                    clearstatcache(true, $temporaire);
                    $nouveau = (int) filesize($temporaire);

                    // Une photo que la réduction n'allège pas reste telle quelle.
                    if ($nouveau <= 0 || $nouveau >= $poids) {
                        continue;
                    }

                    $reprises++;
                    $avant += $poids;
                    $apres += $nouveau;
                    $this->line(sprintf(
                        '  %s %s : %d × %d, %d Ko → %d Ko',
                        $appliquer ? 'allégée' : 'allégerait',
                        $chemin, $dimensions[0], $dimensions[1], intdiv($poids, 1024), intdiv($nouveau, 1024)
                    ));

                    if ($appliquer) {
                        $original = "originaux/{$chemin}";
                        if (! $disque->exists($original)) {
                            $disque->put($original, $octets);
                        }
                        $disque->put($chemin, (string) file_get_contents($temporaire), 'public');
                    }
                } catch (\Throwable $e) {
                    $this->error("  échec sur {$chemin} : {$e->getMessage()}");
                    $echecs++;
                } finally {
                    @unlink($temporaire);
                }
            }
        });

        $this->newLine();
        if ($interrompue) {
            $this->warn("Arrêtée après {$dureeMax} s : relancez pour la suite, ce qui est fait ne sera pas refait.");
        }
        $this->info(sprintf(
            '%d photo(s) examinée(s), %d %s : %.1f Mo → %.1f Mo. Échecs : %d.',
            $vues, $reprises, $appliquer ? 'allégée(s)' : 'à alléger',
            $avant / 1048576, $apres / 1048576, $echecs
        ));

        return $echecs > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * `uploads/xxx.jpg` depuis l'URL publique d'une photo du disque des médias
     * (stockage objet ou disque local) ; null pour une adresse d'ailleurs.
     */
    private function cheminDepuisUrl(string $url): ?string
    {
        $racine = rtrim(Storage::disk(config('filesystems.media'))->url(''), '/');
        $chemin = str_starts_with($url, $racine.'/') ? substr($url, strlen($racine) + 1) : null;
        // Le disque local sert ses fichiers sous /storage/, avec ou sans domaine.
        if ($chemin === null && preg_match('#/storage/(uploads/[^?]+)$#', $url, $m)) {
            $chemin = $m[1];
        }

        return $chemin !== null && str_starts_with($chemin, 'uploads/') ? $chemin : null;
    }
}
