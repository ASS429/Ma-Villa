<?php

namespace App\Services;

/**
 * Ce qui est ouvert, parmi les services aux voyageurs — et pour qui.
 *
 * Une famille fermée n'existe pour personne, **sauf pour l'administration**,
 * qui la voit en aperçu : c'est ce qui permet de tester en production avant
 * d'ouvrir au public, sans seconde installation. L'aperçu se lit sur le jeton
 * de la requête ; un visiteur anonyme n'en a jamais.
 */
class Prestations
{
    public static function apercu(): bool
    {
        return (request()->user() ?? auth('sanctum')->user())?->role === 'admin';
    }

    /** Les familles ouvertes au public, sans tenir compte de l'aperçu. */
    public static function famillesOuvertes(): array
    {
        return array_keys(array_filter(
            config('prestations.familles'),
            fn (array $f) => (bool) ($f['actif'] ?? false),
        ));
    }

    /** Les familles visibles par l'appelant : toutes pour l'administration. */
    public static function famillesVisibles(): array
    {
        return self::apercu()
            ? array_keys(config('prestations.familles'))
            : self::famillesOuvertes();
    }

    /** Les clés de prestation qu'on peut demander, pour l'appelant. */
    public static function clesDemandables(): array
    {
        $familles = self::famillesVisibles();

        return array_keys(array_filter(
            config('prestations.catalogue'),
            fn (array $p) => in_array($p['famille'], $familles, true),
        ));
    }
}
