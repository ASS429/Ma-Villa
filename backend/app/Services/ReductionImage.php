<?php

namespace App\Services;

/**
 * La réduction d'une photo avant qu'elle soit servie : à l'envoi
 * (`PhotoController::upload`) et pour les photos déjà en ligne
 * (`passetemps:alleger-photos`). Un seul code, pour que les deux donnent la
 * même image.
 */
class ReductionImage
{
    /** Le plus grand côté d'une photo servie, en pixels. */
    public const COTE_MAX = 2000;

    /** Au-delà, une photo déjà en ligne mérite d'être reprise, même si elle est à la bonne taille. */
    public const POIDS_MAX = 600 * 1024;

    /**
     * Les dimensions d'une image (largeur, hauteur) lues dans l'en-tête, sans
     * la décoder ; null si ce n'en est pas une.
     *
     * @return array{0: int, 1: int}|null
     */
    public function dimensions(string $chemin): ?array
    {
        $infos = @getimagesize($chemin);

        return $infos === false ? null : [(int) $infos[0], (int) $infos[1]];
    }

    /**
     * Ramène le plus grand côté à 2000 px et réencode en JPEG qualité 82, sur
     * place. Sur ce marché la data mobile est payée au volume : servir une
     * photo de smartphone brute coûte réellement quelque chose au visiteur.
     *
     * Le plafond porte sur le plus grand côté, pas sur la largeur : une photo
     * de téléphone en portrait (1840 × 3264) passait telle quelle, à 1,3 à
     * 1,7 Mo pièce — 11 Mo pour une fiche au téléphone (relevé le 6 nov. 2026).
     */
    public function reduire(string $chemin, int $coteMax = self::COTE_MAX): void
    {
        if (! extension_loaded('gd')) {
            return;
        }

        // Une photo de 50 Mpx décodée occupe 200 Mo : plus que la limite par
        // défaut, et l'envoi échouait sur une erreur fatale, que rien ne
        // rattrape. Relevée ici seulement, le temps du décodage — les
        // dimensions sont déjà plafonnées à l'entrée.
        $limite = ini_get('memory_limit');
        ini_set('memory_limit', '512M');
        $source = $cible = null;

        try {
            $infos = @getimagesize($chemin);
            if ($infos === false) {
                return;
            }

            [$largeur, $hauteur] = $infos;
            $source = match ($infos['mime']) {
                'image/jpeg' => @imagecreatefromjpeg($chemin),
                'image/png'  => @imagecreatefrompng($chemin),
                'image/webp' => @imagecreatefromwebp($chemin),
                default      => null,
            };

            if (! $source) {
                return;
            }

            // Un téléphone enregistre souvent l'image couchée, avec une étiquette
            // qui dit de la redresser. Le réencodage efface l'étiquette : sans ce
            // redressement, la photo s'afficherait de travers.
            $angle = $infos['mime'] === 'image/jpeg'
                ? match ($this->orientationExif($chemin)) { 3 => 180, 6 => 270, 8 => 90, default => 0 }
                : 0;
            if ($angle !== 0 && ($redressee = imagerotate($source, $angle, 0)) !== false) {
                $source = $redressee;
                [$largeur, $hauteur] = [imagesx($source), imagesy($source)];
            }

            // Une image déjà raisonnable est simplement réencodée.
            $cote = max($largeur, $hauteur);
            $ratio = $cote > $coteMax ? $coteMax / $cote : 1.0;
            $cible = imagecreatetruecolor((int) round($largeur * $ratio), (int) round($hauteur * $ratio));

            imagefill($cible, 0, 0, imagecolorallocate($cible, 255, 255, 255));
            imagecopyresampled(
                $cible, $source,
                0, 0, 0, 0,
                imagesx($cible), imagesy($cible),
                $largeur, $hauteur
            );

            imagejpeg($cible, $chemin, 82);
            // Pas d'imagedestroy() : déprécié depuis PHP 8.5, et les objets
            // GdImage sont libérés par le ramasse-miettes.
        } catch (\Throwable $e) {
            // L'original reste servi tel quel : mieux vaut une photo lourde
            // qu'une annonce sans photo.
            report($e);
        } finally {
            // Libérer avant de redescendre : sous la mémoire déjà occupée, la
            // limite refuserait de baisser.
            $source = $cible = null;
            ini_set('memory_limit', (string) $limite);
        }
    }

    /**
     * L'orientation EXIF d'un JPEG (1 à 8, 1 si absente), lue dans l'en-tête.
     * Sans l'extension `exif`, absente de certains environnements : seule
     * l'étiquette 0x0112 du premier répertoire nous intéresse.
     */
    private function orientationExif(string $chemin): int
    {
        $o = @file_get_contents($chemin, false, null, 0, 131072);
        if (! is_string($o) || ! str_starts_with($o, "\xFF\xD8")) {
            return 1;
        }

        $n = strlen($o);
        $lire = static function (int $position, int $taille, string $format) use ($o, $n): ?int {
            return $position >= 0 && $position + $taille <= $n ? unpack($format, substr($o, $position, $taille))[1] : null;
        };

        for ($i = 2; $i + 4 <= $n && $o[$i] === "\xFF";) {
            $marqueur = ord($o[$i + 1]);
            if ($marqueur === 0xDA) {
                break; // les données de l'image commencent : plus d'en-tête à lire
            }
            $longueur = $lire($i + 2, 2, 'n') ?? 0;

            if ($marqueur === 0xE1 && substr($o, $i + 4, 6) === "Exif\0\0") {
                $tiff = $i + 10;
                $petit = substr($o, $tiff, 2) === 'II';
                $repertoire = $tiff + ($lire($tiff + 4, 4, $petit ? 'V' : 'N') ?? 0);
                $entrees = $lire($repertoire, 2, $petit ? 'v' : 'n') ?? 0;
                for ($e = 0; $e < $entrees; $e++) {
                    $p = $repertoire + 2 + 12 * $e;
                    if ($lire($p, 2, $petit ? 'v' : 'n') === 0x0112) {
                        $valeur = $lire($p + 8, 2, $petit ? 'v' : 'n') ?? 1;

                        return $valeur >= 1 && $valeur <= 8 ? $valeur : 1;
                    }
                }

                return 1;
            }

            if ($longueur < 2) {
                break;
            }
            $i += 2 + $longueur;
        }

        return 1;
    }
}
