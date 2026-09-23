<?php

namespace App\Services;

/**
 * Range une saisie libre sous une ville connue — sans rien perdre.
 *
 * « Saly velingara » devient la ville **Saly** et le quartier **Velingara** :
 * la recherche et la liste des destinations retrouvent alors un seul Saly, et
 * le propriétaire garde la précision qu'il avait écrite.
 *
 * La normalisation vit **à l'écriture**, pas dans l'interface : le site, le
 * mobile et tout client futur passent par la même API, et une correction faite
 * dans un formulaire ne protège que ce formulaire.
 *
 * Une ville inconnue est conservée telle quelle. On ne refuse pas une saisie
 * parce qu'elle manque à notre liste — c'est la liste qui est incomplète.
 */
final class Ville
{
    /**
     * Lettres accentuées et séparateurs, **un caractère pour un caractère**.
     *
     * C'est la contrainte qui fait tout marcher : les positions de la forme
     * comparable et celles de la saisie d'origine se correspondent, donc ce
     * qu'on reconnaît dans l'une se découpe dans l'autre.
     */
    private const TRANSLITERATION = [
        'à' => 'a', 'á' => 'a', 'â' => 'a', 'ä' => 'a', 'ã' => 'a', 'å' => 'a',
        'ç' => 'c', 'è' => 'e', 'é' => 'e', 'ê' => 'e', 'ë' => 'e',
        'ì' => 'i', 'í' => 'i', 'î' => 'i', 'ï' => 'i', 'ñ' => 'n',
        'ò' => 'o', 'ó' => 'o', 'ô' => 'o', 'ö' => 'o', 'õ' => 'o',
        'ù' => 'u', 'ú' => 'u', 'û' => 'u', 'ü' => 'u', 'ý' => 'y', 'ÿ' => 'y',
        'œ' => 'o', 'æ' => 'a', 'ß' => 's',
        '-' => ' ', '_' => ' ', "'" => ' ', '’' => ' ', ',' => ' ', '.' => ' ', '/' => ' ',
    ];

    /**
     * @return array{ville: string, quartier: ?string}
     */
    public static function normaliser(?string $saisie): array
    {
        $brut = trim((string) preg_replace('/\s+/u', ' ', (string) $saisie));

        if ($brut === '') {
            return ['ville' => '', 'quartier' => null];
        }

        $comparable = self::comparable($brut);

        foreach (self::formes() as [$ville, $forme, $estUnQuartier]) {
            $trouve = self::trouver($comparable, $forme);

            if ($trouve === null) {
                continue;
            }

            [$debut, $longueur] = $trouve;
            $reconnu = mb_substr($brut, $debut, $longueur);
            $reste = mb_substr($brut, 0, $debut).' '.mb_substr($brut, $debut + $longueur);
            $reste = self::retirerLesRedondances($reste, $ville);

            // Un quartier reconnu est gardé : « Ngor » donne Dakar · Ngor. Une
            // autre écriture de la ville, elle, a déjà tout dit.
            $quartier = $estUnQuartier ? trim($reconnu.' '.$reste) : $reste;

            return ['ville' => $ville, 'quartier' => self::quartier($quartier)];
        }

        return ['ville' => $brut, 'quartier' => null];
    }

    /**
     * Les villes proposées à la recherche et à la publication.
     *
     * ⚠️ **Ce n'est pas l'ordre de `config('villes.liste')`, et ce ne doit pas
     * l'être.** Celui-là va du plus précis au plus général parce que c'est lui
     * qui range « Mbour Saly » sous Saly : c'est un ordre d'algorithme, lu par
     * `formes()`, et le changer casserait le rangement.
     *
     * Servi tel quel à l'interface, il plaçait Dakar en douzième position
     * derrière cinq villages, et faisait des six pastilles de la feuille mobile
     * cinq destinations **sans une seule annonce** — un raccourci qui ne mène
     * nulle part. Relevé par l'exploitant le 23 septembre 2026.
     *
     * Ici : les villes pourvues d'abord, de la mieux pourvue à la moins, puis
     * le reste par ordre alphabétique. Même règle que les catégories de la
     * boutique — un filtre qui ne rend rien use la confiance.
     *
     * @param  list<string>  $pourvues  Villes ayant au moins une annonce publiée,
     *                                  de la mieux pourvue à la moins.
     * @return list<string>
     */
    public static function liste(array $pourvues = []): array
    {
        // Une ville pourvue peut manquer à la référence : elle a été saisie
        // avant d'y être connue. Elle a des annonces, donc elle se propose.
        $devant = array_values(array_unique(array_filter($pourvues)));

        $reste = array_values(array_diff(config('villes.liste', []), $devant));
        usort($reste, fn ($a, $b) => strcmp(self::comparable($a), self::comparable($b)));

        return [...$devant, ...$reste];
    }

    /**
     * Toutes les écritures reconnues, dans l'ordre où il faut les essayer.
     *
     * L'ordre des villes vient de la configuration (de la plus précise à la
     * plus générale) : c'est lui qui range « Mbour Saly » à Saly.
     *
     * À l'intérieur d'une ville, la forme **la plus longue** passe devant, sans
     * quoi « Saly Portudal » laisserait « Portudal » en quartier et « Dakar
     * Almadies » rendrait « Dakar » comme quartier de lui-même.
     *
     * @return list<array{0: string, 1: string, 2: bool}>
     */
    private static function formes(): array
    {
        static $formes = null;

        if ($formes !== null) {
            return $formes;
        }

        $alias = config('villes.alias', []);
        $quartiers = config('villes.quartiers', []);
        $formes = [];

        foreach (config('villes.liste', []) as $ville) {
            $variantes = [];

            foreach (array_merge([$ville], $alias[$ville] ?? []) as $ecriture) {
                $variantes[self::comparable($ecriture)] = false;
            }

            foreach ($quartiers[$ville] ?? [] as $quartier) {
                // Une écriture déjà connue comme ville le reste : on ne la
                // rétrograde pas en quartier.
                $variantes[self::comparable($quartier)] ??= true;
            }

            uksort($variantes, fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a));

            foreach ($variantes as $variante => $estUnQuartier) {
                $formes[] = [$ville, (string) $variante, $estUnQuartier];
            }
        }

        return $formes;
    }

    /**
     * Position de la forme dans la saisie comparable, en caractères.
     *
     * Les limites empêchent « Sali » de reconnaître une ville dans « Salimata »,
     * et « Ndar » d'en trouver une dans « Ndarville ».
     *
     * @return array{0: int, 1: int}|null
     */
    private static function trouver(string $comparable, string $forme): ?array
    {
        $motif = '/(?<![a-z0-9])'.preg_quote($forme, '/').'(?![a-z0-9])/';

        if (preg_match($motif, $comparable, $trouve, PREG_OFFSET_CAPTURE) !== 1) {
            return null;
        }

        // La forme comparable ne contient que de l'ASCII : l'octet et le
        // caractère y sont au même rang, et ce rang vaut aussi dans la saisie.
        return [$trouve[0][1], strlen($trouve[0][0])];
    }

    /**
     * Retire du reste ce qui ne fait que répéter la ville.
     *
     * Deux cas, rencontrés tous les deux : la ville nommée en plus de son
     * quartier (« Dakar Almadies »), et la commune nommée en plus de la
     * localité (« Mbour Saly »). Sans cela, le quartier hériterait d'un nom de
     * ville.
     */
    private static function retirerLesRedondances(string $reste, string $ville): string
    {
        $redondances = array_merge(
            [$ville],
            config('villes.alias', [])[$ville] ?? [],
            array_filter([config('villes.dans', [])[$ville] ?? null])
        );

        foreach ($redondances as $redondance) {
            $trouve = self::trouver(self::comparable($reste), self::comparable($redondance));

            if ($trouve === null) {
                continue;
            }

            [$debut, $longueur] = $trouve;
            $reste = mb_substr($reste, 0, $debut).' '.mb_substr($reste, $debut + $longueur);
        }

        return $reste;
    }

    /** Ce qui reste de la saisie une fois la ville retirée, ou rien. */
    private static function quartier(string $reste): ?string
    {
        $quartier = trim((string) preg_replace('/\s+/u', ' ', $reste), " \t\n\r\0\x0B-–—,;·/");

        if ($quartier === '') {
            return null;
        }

        return mb_strtoupper(mb_substr($quartier, 0, 1)).mb_substr($quartier, 1);
    }

    /**
     * Minuscules, sans accents, séparateurs ramenés à l'espace — et toujours
     * un caractère pour un caractère, sans quoi le découpage de la saisie
     * d'origine tomberait à côté.
     */
    private static function comparable(string $texte): string
    {
        $sortie = '';

        foreach (mb_str_split(mb_strtolower($texte)) as $caractere) {
            $remplacement = self::TRANSLITERATION[$caractere] ?? $caractere;

            $sortie .= (strlen($remplacement) === 1 && preg_match('/[a-z0-9 ]/', $remplacement) === 1)
                ? $remplacement
                : '?';
        }

        return $sortie;
    }
}
