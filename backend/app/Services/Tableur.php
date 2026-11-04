<?php

namespace App\Services;

/**
 * Un fichier CSV qu'Excel ouvre du premier coup en français : point-virgule,
 * marque d'ordre des octets pour l'UTF-8, retours à la ligne Windows.
 *
 * Une cellule qui commence par `=`, `+`, `-` ou `@`, Excel l'exécute comme une
 * formule. Or ces fichiers portent ce qu'un visiteur a tapé dans un formulaire :
 * un nom « =HYPERLINK(…) » ouvert par l'équipe, c'est un lien piégé dans son
 * tableur. Ces cellules reçoivent une apostrophe en tête, sauf les numéros de
 * téléphone : « +221 77… » devient « 00221 77… », qui dit la même chose et que
 * tout le monde peut recopier.
 */
final class Tableur
{
    /**
     * @param  list<string>  $entetes
     * @param  iterable<array<int, mixed>>  $lignes
     */
    public static function csv(array $entetes, iterable $lignes): string
    {
        $sortie = "\u{FEFF}".self::ligne($entetes);
        foreach ($lignes as $ligne) {
            $sortie .= self::ligne($ligne);
        }

        return $sortie;
    }

    /** @param  array<int, mixed>  $cellules */
    private static function ligne(array $cellules): string
    {
        return implode(';', array_map(fn ($c) => self::cellule($c), $cellules))."\r\n";
    }

    private static function cellule(mixed $valeur): string
    {
        if (is_int($valeur) || is_float($valeur)) {
            return (string) $valeur;
        }

        $texte = (string) $valeur;

        if (preg_match('/^\+\d[\d\s.\-()]*$/', $texte)) {
            $texte = '00'.substr($texte, 1);
        } elseif (preg_match('/^[=+\-@\t\r]/', $texte)) {
            $texte = "'".$texte;
        }

        return preg_match('/[;"\r\n]/', $texte)
            ? '"'.str_replace('"', '""', $texte).'"'
            : $texte;
    }
}
