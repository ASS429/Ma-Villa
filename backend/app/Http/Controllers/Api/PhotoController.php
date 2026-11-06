<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Logement;
use App\Models\Oeuvre;
use App\Models\Villa;
use App\Services\ReductionImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PhotoController extends Controller
{
    /** 60 Mpx : au-delà de tout appareil photo de téléphone, en deçà d'une image piégée. */
    private const PIXELS_MAX = 60_000_000;

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

        if ($refus = $this->plafondAtteint($villa->photos()->count(), count($request->photos))) {
            return $refus;
        }

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

        if ($refus = $this->plafondAtteint($logement->photos()->count(), count($request->photos))) {
            return $refus;
        }

        $photos = collect($request->photos)->map(fn($p, $i) => [
            'url'   => $p['url'],
            'alt'   => $p['alt'] ?? null,
            'ordre' => $p['ordre'] ?? $i,
        ]);

        $created = $logement->photos()->createMany($photos->toArray());

        return response()->json($created, 201);
    }

    /**
     * Photos d'un article de la boutique.
     *
     * Pas de `authorize` : la route vit derrière le filtre `admin`, et PasseTemps
     * est le seul vendeur — il n'y a pas de propriétaire d'article à distinguer.
     * Mêmes règles de validation que pour une villa : le schéma doit être
     * http(s), et le nombre par envoi est plafonné.
     */
    public function storeForOeuvre(Request $request, Oeuvre $oeuvre): JsonResponse
    {
        $request->validate(self::REGLES_PHOTOS, self::MESSAGES_PHOTOS);

        if ($refus = $this->plafondAtteint($oeuvre->photos()->count(), count($request->photos))) {
            return $refus;
        }

        $photos = collect($request->photos)->map(fn ($p, $i) => [
            'url'   => $p['url'],
            'alt'   => $p['alt'] ?? null,
            'ordre' => $p['ordre'] ?? $i,
        ]);

        return response()->json($oeuvre->photos()->createMany($photos->toArray()), 201);
    }

    public function destroyForOeuvre(Oeuvre $oeuvre, int $photo): JsonResponse
    {
        $oeuvre->photos()->findOrFail($photo)->delete();

        return response()->json(['message' => 'Photo supprimée.']);
    }

    /**
     * Refuse un envoi qui ferait dépasser le plafond, en disant de combien.
     *
     * Le message compte autant que le refus : « il en reste 2 » se répare en
     * choisissant deux photos, « trop de photos » se répare en devinant.
     */
    private function plafondAtteint(int $detenues, int $envoyees): ?JsonResponse
    {
        $plafond = (int) config('annonces.photos_max');

        if ($detenues + $envoyees <= $plafond) {
            return null;
        }

        $reste = max(0, $plafond - $detenues);

        return response()->json([
            'message' => $reste === 0
                ? "Cette annonce a déjà ses {$plafond} photos. Supprimez-en une pour en ajouter une autre."
                : "Il ne reste de la place que pour {$reste} photo".($reste > 1 ? 's' : '')
                  .". Le maximum est de {$plafond} par annonce.",
        ], 422);
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
            // Les dimensions se lisent dans l'en-tête, sans décoder : une image
            // de quelques Ko peut annoncer 30 000 × 30 000 pixels, que le
            // décodage déploierait en gigaoctets de mémoire.
            $dimensions = @getimagesize($fichier->getRealPath());
            if ($dimensions !== false && $dimensions[0] * $dimensions[1] > self::PIXELS_MAX) {
                return response()->json([
                    'message' => 'Image trop grande : 60 mégapixels au maximum.',
                    'errors'  => ['file' => ['Image trop grande : 60 mégapixels au maximum.']],
                ], 422);
            }

            app(ReductionImage::class)->reduire($fichier->getRealPath());
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

    public function destroy(Villa $villa, int $photo): JsonResponse
    {
        $this->authorize('update', $villa);
        $villa->photos()->findOrFail($photo)->delete();

        return response()->json(['message' => 'Photo supprimée.']);
    }
}
