<?php

namespace App\Services;

use App\Models\Villa;
use Illuminate\Support\Facades\Schema;

/**
 * Une position approximative pour les annonces qui n'en ont pas.
 *
 * Relevé le 31 octobre 2026 : 6 annonces sur 57 avaient des coordonnées, et
 * la carte des résultats répondait presque toujours « aucun hébergement
 * placé ». Les propriétaires saisissent la position à la main, en chiffres ;
 * les imports n'en avaient pas. Sur décision de l'exploitant, les autres sont
 * placées **au centre de leur quartier**, ou de leur ville à défaut.
 *
 * ⚠️ Une position approchée n'est pas une adresse. `position_approximative`
 * le dit à l'écran : la fiche montre une carte élargie, sans marqueur, et le
 * dit en toutes lettres ; Google ne reçoit pas ces coordonnées. Dès que le
 * propriétaire saisit la sienne, le drapeau tombe (`VillaController`).
 *
 * Les centres viennent d'OpenStreetMap (Nominatim), relevés le 31 octobre
 * 2026 — pas de mémoire. Les annonces d'un même lieu sont écartées en
 * spirale de quelques centaines de mètres : empilées sur un seul point, leurs
 * marqueurs se recouvriraient et une seule resterait cliquable.
 */
final class PositionApprochee
{
    /** Quartier (ou mot de l'adresse) → centre. Clés en minuscules, sans accents. */
    private const QUARTIERS = [
        'virage'        => [14.75491, -17.49553],
        'almadies'      => [14.74419, -17.51753],
        'mamelles'      => [14.73116, -17.50030],
        'mermoz'        => [14.70745, -17.47440],
        'ngor'          => [14.74879, -17.51496],
        'ouest foire'   => [14.74939, -17.47021],
        'plateau'       => [14.67682, -17.43929],
        'yoff'          => [14.76036, -17.46815],
        'saly carrefour' => [14.44349, -16.98887],
        'niakh niakhal' => [14.43026, -16.99842],
    ];

    /** Ville → centre, quand le quartier est inconnu. */
    private const VILLES = [
        'dakar'      => [14.69342, -17.44794],
        'saly'       => [14.44111, -17.01483],
        'ngaparou'   => [14.46352, -17.05669],
        'somone'     => [14.48571, -17.07560],
        'mbour'      => [14.41670, -16.96670],
        'thies'      => [14.79146, -16.92561],
        'ziguinchor' => [12.56349, -16.27246],
    ];

    /** Pas de la spirale, en degrés (~130 m). */
    private const PAS = 0.0012;

    /** Le centre connu pour ce lieu, `null` si on ne sait pas. */
    public static function centre(?string $ville, ?string $quartier, ?string $adresse = null): ?array
    {
        // L'adresse d'abord : « Virage » y figure quand le quartier dit « Yoff ».
        foreach ([self::normaliser($adresse), self::normaliser($quartier)] as $texte) {
            foreach (self::QUARTIERS as $cle => $centre) {
                if ($texte !== '' && str_contains($texte, $cle)) {
                    return $centre;
                }
            }
        }

        return self::VILLES[self::normaliser($ville)] ?? null;
    }

    /**
     * Place toutes les annonces sans coordonnées. Rend le nombre d'annonces
     * placées. Rejouable : une annonce déjà située n'est jamais déplacée.
     */
    public static function placerCelles(): int
    {
        // ⚠️ Appelée par `ImportLot`, donc par des migrations **antérieures** à
        // celle qui crée la colonne (2026_10_31_000004). Le 31 octobre, l'import
        // de la villa de Saly (000003) l'a appelée trop tôt : sous Postgres,
        // l'erreur — pourtant rattrapée — a annulé toute la transaction de la
        // migration, import compris, et Laravel l'a quand même notée « faite ».
        // Sur une base neuve, les imports du lot le referaient.
        if (! Schema::hasColumn('villas', 'position_approximative')) {
            return 0;
        }

        $rangs = [];
        $placees = 0;

        Villa::query()
            ->where(fn ($q) => $q->whereNull('latitude')->orWhereNull('longitude'))
            ->orderBy('id')
            ->get()
            ->each(function (Villa $villa) use (&$rangs, &$placees) {
                $centre = self::centre($villa->ville, $villa->quartier, $villa->adresse);
                if (! $centre) {
                    return;
                }

                $cle = implode(',', $centre);
                $rang = $rangs[$cle] = ($rangs[$cle] ?? 0) + 1;
                [$lat, $lng] = self::ecarter($centre, $rang);

                $villa->forceFill([
                    'latitude'               => $lat,
                    'longitude'              => $lng,
                    'position_approximative' => true,
                ])->saveQuietly();
                $placees++;
            });

        return $placees;
    }

    /** Spirale à l'angle d'or : chaque rang tombe à un endroit différent. */
    private static function ecarter(array $centre, int $rang): array
    {
        $angle = $rang * 2.399963;
        $rayon = self::PAS * sqrt($rang);

        return [
            round($centre[0] + $rayon * sin($angle), 6),
            round($centre[1] + $rayon * cos($angle), 6),
        ];
    }

    private static function normaliser(?string $texte): string
    {
        $texte = mb_strtolower(trim((string) $texte));

        return strtr($texte, ['è' => 'e', 'é' => 'e', 'ê' => 'e', 'ë' => 'e', 'à' => 'a', 'â' => 'a', 'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'û' => 'u', 'ç' => 'c', '-' => ' ']);
    }
}
