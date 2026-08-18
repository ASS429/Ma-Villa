<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Logement;
use App\Models\Villa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PhotoController extends Controller
{
    /**
     * L'URL d'une photo n'était validée que comme chaîne : un propriétaire
     * pouvait enregistrer n'importe quoi — un pixel de suivi, une image
     * hébergée ailleurs qui change de contenu après validation, ou un
     * `javascript:` qui, sans s'exécuter dans un `src`, n'a rien à faire en
     * base.
     *
     * Deux gardes : le schéma doit être http(s), et le nombre de photos par
     * envoi est plafonné — sans quoi un seul appel pouvait insérer des
     * milliers de lignes.
     */
    private const REGLES_PHOTOS = [
        'photos'         => 'required|array|min:1|max:40',
        'photos.*.url'   => 'required|string|max:2048|url:http,https',
        'photos.*.alt'   => 'nullable|string|max:255',
        'photos.*.ordre' => 'integer|min:0|max:999',
    ];

    private const MESSAGES_PHOTOS = [
        'photos.max'       => '40 photos au maximum par envoi.',
        'photos.*.url.url' => 'Chaque photo doit être une adresse http ou https.',
    ];

    public function storeForVilla(Request $request, Villa $villa): JsonResponse
    {
        $this->authorize('update', $villa);

        $request->validate(self::REGLES_PHOTOS, self::MESSAGES_PHOTOS);

        $photos = collect($request->photos)->map(fn($p, $i) => [
            'url'   => $p['url'],
            'alt'   => $p['alt'] ?? null,
            'ordre' => $p['ordre'] ?? $i,
        ]);

        $created = $villa->photos()->createMany($photos->toArray());

        return response()->json($created, 201);
    }

    public function storeForLogement(Request $request, Villa $villa, Logement $logement): JsonResponse
    {
        $this->authorize('update', $villa);

        $request->validate(self::REGLES_PHOTOS, self::MESSAGES_PHOTOS);

        $photos = collect($request->photos)->map(fn($p, $i) => [
            'url'   => $p['url'],
            'alt'   => $p['alt'] ?? null,
            'ordre' => $p['ordre'] ?? $i,
        ]);

        $created = $logement->photos()->createMany($photos->toArray());

        return response()->json($created, 201);
    }

    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            // 100 Mo acceptés auparavant : un propriétaire mettait en ligne des
            // photos de 6 Mo re-téléchargées telles quelles par chaque visiteur.
            'file' => 'required|file|mimes:jpeg,jpg,png,webp,mp4,mov,webm|max:20480',
        ], [
            'file.max' => 'Fichier trop lourd (20 Mo maximum).',
            'file.mimes' => 'Formats acceptés : JPEG, PNG, WebP, MP4, MOV, WebM.',
        ]);

        $fichier = $request->file('file');
        $estImage = str_starts_with((string) $fichier->getMimeType(), 'image/');

        // Le redimensionnement a lieu sur le fichier temporaire, avant l'envoi :
        // avec un stockage objet il n'existe aucun chemin local à retoucher
        // après coup.
        if ($estImage) {
            $this->reduireImage($fichier->getRealPath());
        }

        $disque = config('filesystems.media');
        $nom = Str::random(40).'.'.($estImage ? 'jpg' : $fichier->getClientOriginalExtension());

        Storage::disk($disque)->put(
            $chemin = "uploads/{$nom}",
            file_get_contents($fichier->getRealPath()),
            'public'
        );

        return response()->json(['url' => $this->urlPublique($disque, $chemin)]);
    }

    /**
     * Le disque « public » renvoie un chemin relatif qu'il faut préfixer du
     * domaine ; un stockage objet renvoie déjà une URL absolue.
     */
    private function urlPublique(string $disque, string $chemin): string
    {
        $url = Storage::disk($disque)->url($chemin);

        return str_starts_with($url, 'http') ? $url : url($url);
    }

    /**
     * Redimensionne à 2000 px de large maximum et réencode en JPEG qualité 82,
     * sur place. Sur ce marché la data mobile est payée au volume : servir une
     * photo de smartphone brute coûte réellement quelque chose au visiteur.
     */
    private function reduireImage(string $chemin, int $largeurMax = 2000): void
    {
        if (! extension_loaded('gd')) {
            return;
        }

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

            // Une image déjà raisonnable est simplement réencodée.
            $ratio = $largeur > $largeurMax ? $largeurMax / $largeur : 1.0;
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
        }
    }

    public function destroy(Villa $villa, int $photo): JsonResponse
    {
        $this->authorize('update', $villa);
        $villa->photos()->findOrFail($photo)->delete();

        return response()->json(['message' => 'Photo supprimée.']);
    }
}
