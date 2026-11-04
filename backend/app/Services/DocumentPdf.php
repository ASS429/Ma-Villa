<?php

namespace App\Services;

use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\Client\Pool;
use Illuminate\Support\Facades\Http;

/**
 * Une vue Blade rendue en PDF : devis, fiche d'un compte, catalogue d'un
 * propriétaire.
 *
 * dompdf ne va chercher **aucune** ressource au-dehors (`isRemoteEnabled` à
 * faux) et n'exécute pas de PHP : un document ne doit pas pouvoir faire sortir
 * le serveur ni lire ses fichiers. Les images lui arrivent donc déjà lues, en
 * `data:` URI, par `imageLocale()` ou `imageDistante()`.
 */
final class DocumentPdf
{
    /** @param  array<string, mixed>  $donnees */
    public static function depuisVue(string $vue, array $donnees): string
    {
        $options = new Options;
        $options->setIsRemoteEnabled(false);
        $options->setIsPhpEnabled(false);
        $options->setIsJavascriptEnabled(false);
        $options->setDefaultFont('DejaVu Sans');
        $options->setDefaultPaperSize('a4');

        $pdf = new Dompdf($options);
        $pdf->loadHtml(view($vue, $donnees)->render(), 'UTF-8');
        $pdf->setPaper('a4');
        $pdf->render();

        return (string) $pdf->output();
    }

    /** Un fichier de `resources/pdf`, prêt à poser dans un `<img>`. */
    public static function imageLocale(string $nom): ?string
    {
        $chemin = resource_path('pdf/'.basename($nom));
        if (! is_file($chemin)) {
            return null;
        }

        $type = mime_content_type($chemin) ?: 'image/png';

        return 'data:'.$type.';base64,'.base64_encode((string) file_get_contents($chemin));
    }

    /**
     * Des photos d'annonce, lues **en parallèle** et réduites ici : les
     * originaux pèsent plusieurs centaines de kilo-octets, et dompdf les
     * embarquerait tels quels. Une photo qui ne se lit pas manque, sans plus :
     * le document se fait sans elle.
     *
     * `$ratio` (largeur ÷ hauteur) recadre au centre : dompdf ne sait pas
     * recadrer, et une hauteur imposée déformerait la photo.
     *
     * @param  array<string, string|null>  $urls
     * @return array<string, string>
     */
    public static function imagesDistantes(array $urls, int $largeur = 640, ?float $ratio = null): array
    {
        $valides = array_filter($urls, fn ($u) => is_string($u) && preg_match('#^https?://#', $u));
        if ($valides === []) {
            return [];
        }

        try {
            $reponses = Http::pool(fn (Pool $pool) => array_map(
                fn ($cle) => $pool->as((string) $cle)->timeout(8)->get($valides[$cle]),
                array_keys($valides),
            ));
        } catch (\Throwable) {
            return [];
        }

        $images = [];
        foreach ($reponses as $cle => $reponse) {
            if ($reponse instanceof \Illuminate\Http\Client\Response && $reponse->successful()
                && ($image = self::reduire($reponse->body(), $largeur, $ratio))) {
                $images[(string) $cle] = $image;
            }
        }

        return $images;
    }

    /** Une seule photo : même traitement. */
    public static function imageDistante(?string $url, int $largeur = 640): ?string
    {
        return self::imagesDistantes(['une' => $url], $largeur)['une'] ?? null;
    }

    private static function reduire(string $octets, int $largeur, ?float $ratio = null): ?string
    {
        $image = @imagecreatefromstring($octets);
        if ($image === false) {
            return null;
        }
        if ($ratio) {
            $l = imagesx($image);
            $h = imagesy($image);
            [$cl, $ch] = $l / $h > $ratio ? [(int) round($h * $ratio), $h] : [$l, (int) round($l / $ratio)];
            $recadree = imagecrop($image, ['x' => intdiv($l - $cl, 2), 'y' => intdiv($h - $ch, 2), 'width' => $cl, 'height' => $ch]);
            imagedestroy($image);
            if ($recadree === false) {
                return null;
            }
            $image = $recadree;
        }
        if (imagesx($image) > $largeur) {
            $reduite = imagescale($image, $largeur);
            imagedestroy($image);
            if ($reduite === false) {
                return null;
            }
            $image = $reduite;
        }
        ob_start();
        imagejpeg($image, null, 72);
        imagedestroy($image);

        return 'data:image/jpeg;base64,'.base64_encode((string) ob_get_clean());
    }
}
