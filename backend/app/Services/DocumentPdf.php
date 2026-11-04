<?php

namespace App\Services;

use Dompdf\Dompdf;
use Dompdf\Options;

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
     * Une photo d'annonce, lue et réduite ici : les originaux pèsent plusieurs
     * centaines de kilo-octets, et dompdf les embarquerait tels quels.
     * `null` si elle ne se lit pas — le document se fait sans elle.
     */
    public static function imageDistante(?string $url, int $largeur = 640): ?string
    {
        if (! $url || ! preg_match('#^https?://#', $url)) {
            return null;
        }

        try {
            $reponse = \Illuminate\Support\Facades\Http::timeout(6)->get($url);
            if (! $reponse->successful()) {
                return null;
            }
            $image = @imagecreatefromstring($reponse->body());
            if ($image === false) {
                return null;
            }
            $source = imagesx($image);
            if ($source > $largeur) {
                $reduite = imagescale($image, $largeur);
                imagedestroy($image);
                $image = $reduite ?: null;
            }
            if (! $image) {
                return null;
            }
            ob_start();
            imagejpeg($image, null, 72);
            imagedestroy($image);

            return 'data:image/jpeg;base64,'.base64_encode((string) ob_get_clean());
        } catch (\Throwable) {
            return null;
        }
    }
}
