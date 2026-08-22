<?php

namespace App\Services;

use App\Models\User;

/**
 * Ce qu'un compte accepte de recevoir, et par où.
 *
 * Le barème vit dans `config/notifications.php` ; ce service ne fait que le
 * croiser avec ce que l'utilisateur a coché.
 *
 * Deux règles, et la seconde est celle qui protège :
 *
 * 1. Un compte sans préférence enregistrée suit le barème. Rien n'est écrit en
 *    base à l'inscription, si bien qu'un défaut modifié s'applique à tout le
 *    monde plutôt qu'aux seuls nouveaux venus.
 * 2. **Un canal verrouillé est toujours actif**, quoi qu'il y ait en base.
 *    Rater une demande de réservation annule le séjour au bout de 24 h : ce
 *    n'est pas une préférence, c'est le fonctionnement du produit.
 */
final class PreferencesNotification
{
    /**
     * La grille complète d'un utilisateur : ce qu'il reçoit, ce qu'il peut
     * changer, et pourquoi il ne peut pas changer le reste.
     *
     * @return array<string, mixed>
     */
    public static function pour(User $utilisateur): array
    {
        $choisies = (array) ($utilisateur->preferences_notification ?? []);

        $sujets = [];
        foreach ((array) config('notifications.sujets') as $cle => $sujet) {
            $verrouilles = (array) ($sujet['verrouille'] ?? []);
            $canaux = [];

            foreach (array_keys((array) config('notifications.canaux')) as $canal) {
                $verrouille = in_array($canal, $verrouilles, true);

                $canaux[$canal] = [
                    'actif'      => $verrouille || self::actif($choisies, $cle, $canal, $sujet),
                    'verrouille' => $verrouille,
                ];
            }

            $sujets[] = [
                'cle'    => $cle,
                'nom'    => $sujet['nom'],
                'detail' => $sujet['detail'] ?? null,
                'raison' => $sujet['raison'] ?? null,
                'canaux' => $canaux,
            ];
        }

        return [
            'canaux'     => config('notifications.canaux'),
            'sujets'     => $sujets,
            'phrase_sms' => config('notifications.phrase_sms'),
        ];
    }

    /**
     * Ce compte accepte-t-il ce sujet sur ce canal ?
     *
     * C'est la seule fonction que le code d'envoi doit appeler.
     */
    public static function accepte(User $utilisateur, string $sujet, string $canal): bool
    {
        $barème = (array) config("notifications.sujets.{$sujet}");

        if ($barème === []) {
            // Un sujet inconnu ne part pas : mieux vaut une notification
            // manquante qu'une notification que personne ne peut couper.
            return false;
        }

        if (in_array($canal, (array) ($barème['verrouille'] ?? []), true)) {
            return true;
        }

        return self::actif(
            (array) ($utilisateur->preferences_notification ?? []),
            $sujet,
            $canal,
            $barème,
        );
    }

    /**
     * Nettoie ce qui arrive de la requête : seuls les sujets et canaux connus
     * sont retenus, et les verrous ne sont jamais enregistrés — ils sont
     * réappliqués à la lecture, ce qui les rend impossibles à contourner en
     * modifiant la base à la main.
     *
     * @param  array<string, mixed>  $entrant
     * @return array<string, array<string, bool>>
     */
    public static function assainir(array $entrant): array
    {
        $canauxConnus = array_keys((array) config('notifications.canaux'));
        $propre = [];

        foreach ((array) config('notifications.sujets') as $cle => $sujet) {
            if (! isset($entrant[$cle]) || ! is_array($entrant[$cle])) {
                continue;
            }

            $verrouilles = (array) ($sujet['verrouille'] ?? []);

            foreach ($canauxConnus as $canal) {
                if (in_array($canal, $verrouilles, true)) {
                    continue;
                }
                if (array_key_exists($canal, $entrant[$cle])) {
                    $propre[$cle][$canal] = (bool) $entrant[$cle][$canal];
                }
            }
        }

        return $propre;
    }

    /** @param array<string, mixed> $sujet */
    private static function actif(array $choisies, string $cle, string $canal, array $sujet): bool
    {
        if (isset($choisies[$cle]) && array_key_exists($canal, (array) $choisies[$cle])) {
            return (bool) $choisies[$cle][$canal];
        }

        return (bool) ($sujet['defaut'][$canal] ?? false);
    }
}
