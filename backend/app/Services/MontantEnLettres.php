<?php

namespace App\Services;

/**
 * Un montant écrit en toutes lettres, en français, pour « Arrêté le présent
 * devis à la somme de : cinquante mille francs CFA ».
 *
 * L'image Docker n'a pas l'extension `intl`, d'où l'écriture à la main. On suit
 * l'orthographe traditionnelle : trait d'union sous cent seulement,
 * « vingt et un », « quatre-vingts » et « deux cents » quand rien ne suit ou que
 * suit un nom (« deux cents millions »), mais « deux cent mille » et
 * « quatre-vingt mille », mille étant invariable.
 */
final class MontantEnLettres
{
    private const UNITES = [
        'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
        'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
    ];

    private const DIZAINES = [2 => 'vingt', 3 => 'trente', 4 => 'quarante', 5 => 'cinquante', 6 => 'soixante'];

    public static function francsCfa(int $montant): string
    {
        return self::nombre($montant).(abs($montant) > 1 ? ' francs CFA' : ' franc CFA');
    }

    public static function nombre(int $n): string
    {
        if ($n < 0) {
            return 'moins '.self::nombre(-$n);
        }
        if ($n === 0) {
            return 'zéro';
        }

        $parties = [];
        foreach ([[1_000_000_000, 'milliard'], [1_000_000, 'million']] as [$valeur, $nom]) {
            if ($n >= $valeur) {
                $combien = intdiv($n, $valeur);
                $n %= $valeur;
                // « Million » est un nom : « deux cents millions » prend son s.
                $parties[] = self::jusquAMille($combien, true).' '.$nom.($combien > 1 ? 's' : '');
            }
        }

        if ($n >= 1000) {
            $combien = intdiv($n, 1000);
            $n %= 1000;
            $parties[] = $combien === 1 ? 'mille' : self::jusquAMille($combien, false).' mille';
        }

        if ($n > 0) {
            $parties[] = self::jusquAMille($n, true);
        }

        return implode(' ', $parties);
    }

    /** De 1 à 999. `$final` : rien ne suit, ou un nom — « cents » et « vingts » prennent alors leur s. */
    private static function jusquAMille(int $n, bool $final): string
    {
        $centaines = intdiv($n, 100);
        $reste = $n % 100;
        $mots = [];

        if ($centaines > 0) {
            $mots[] = $centaines === 1
                ? 'cent'
                : self::UNITES[$centaines].' cent'.($reste === 0 && $final ? 's' : '');
        }
        if ($reste > 0) {
            $mots[] = self::jusquACent($reste, $final);
        }

        return implode(' ', $mots);
    }

    /** De 1 à 99. */
    private static function jusquACent(int $n, bool $final): string
    {
        if ($n <= 16) {
            return self::UNITES[$n];
        }
        if ($n < 20) {
            return 'dix-'.self::UNITES[$n - 10];
        }

        $dizaine = intdiv($n, 10);
        $unite = $n % 10;

        // Soixante-dix et quatre-vingt-dix se construisent sur 10 à 19.
        if ($dizaine === 7) {
            return $unite === 1 ? 'soixante et onze' : 'soixante-'.self::jusquACent(10 + $unite, $final);
        }
        if ($dizaine === 9) {
            return 'quatre-vingt-'.self::jusquACent(10 + $unite, $final);
        }
        if ($dizaine === 8) {
            return $unite === 0 ? 'quatre-vingt'.($final ? 's' : '') : 'quatre-vingt-'.self::UNITES[$unite];
        }

        $base = self::DIZAINES[$dizaine];

        return match ($unite) {
            0 => $base,
            1 => $base.' et un',
            default => $base.'-'.self::UNITES[$unite],
        };
    }
}
