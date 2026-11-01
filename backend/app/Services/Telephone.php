<?php

namespace App\Services;

/**
 * Lire un numéro de téléphone tel que les gens l'écrivent.
 *
 * Aucun préfixe n'est filtré, et c'est voulu : 70, 71, 75, 76, 77, 78, les
 * fixes en 33 ou 30 — les plages changent avec les opérateurs, et une liste
 * tenue ici finirait par refuser un numéro qui existe. On ne retient que les
 * chiffres, puis on reconnaît l'indicatif sous ses trois écritures :
 * « +221 », « 221 » et « 00221 », la plus ancienne et encore très courante.
 *
 * Avant le 1er novembre 2026, « 00221 77 123 45 67 » n'était pas ramené à
 * « 771234567 » : la connexion par numéro échouait, et PayDunya refusait le
 * paiement sans dire pourquoi.
 */
final class Telephone
{
    /**
     * Chiffres seuls, préfixe international « 00 » retiré.
     *
     * Aucun numéro national ne commence par 00 : ce préfixe annonce toujours
     * un indicatif, et l'écrire « 00221 » ou « +221 » revient au même.
     */
    public static function chiffres(?string $numero): string
    {
        $chiffres = preg_replace('/\D+/', '', (string) $numero) ?? '';

        return str_starts_with($chiffres, '00') ? substr($chiffres, 2) : $chiffres;
    }

    /**
     * Le numéro national quand il est du pays (indicatif suivi de neuf
     * chiffres), sinon les chiffres avec leur indicatif.
     *
     * Un numéro étranger garde le sien : le retirer ferait entrer en
     * collision un numéro français et un numéro ivoirien qui finissent pareil.
     */
    public static function local(?string $numero, string $indicatif = '221'): string
    {
        $chiffres = self::chiffres($numero);

        if ($indicatif !== '' && str_starts_with($chiffres, $indicatif)
            && strlen($chiffres) === strlen($indicatif) + 9) {
            return substr($chiffres, strlen($indicatif));
        }

        return $chiffres;
    }

    /**
     * La saisie débarrassée de ce qu'un copier-coller y glisse sans qu'on le
     * voie : marques de sens d'écriture (WhatsApp entoure les numéros de
     * U+202A … U+202C), espaces insécables, tabulations.
     *
     * Le numéro reste écrit comme la personne l'a écrit — on ne le reformate
     * pas : c'est ce qu'elle reconnaîtra en le relisant.
     */
    public static function nettoyer(?string $numero): ?string
    {
        if ($numero === null) {
            return null;
        }

        $propre = preg_replace(['/\p{Cf}+/u', '/[\p{Z}\s]+/u'], ['', ' '], $numero);

        // Une suite d'octets invalide en UTF-8 fait échouer preg_replace :
        // mieux vaut garder la saisie telle quelle que la perdre.
        return $propre === null ? trim($numero) : trim($propre);
    }
}
