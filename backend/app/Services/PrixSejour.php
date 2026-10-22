<?php

namespace App\Services;

use App\Models\Tarif;
use Carbon\Carbon;

/**
 * Le prix d'un séjour, des dates d'arrivée et de départ.
 *
 * ── Ce qu'on compte ──────────────────────────────────────────────────
 * Une **nuitée** se compte en nuits : du vendredi au dimanche, deux nuits.
 * Une formule **de jour** (journée, demi-journée, pass) se compte en jours,
 * bornes comprises : du lundi au mercredi, trois jours. Les deux ont longtemps
 * été comptées en nuits, et une journée du lundi au mercredi n'en faisait que
 * deux.
 *
 * ── Les longs séjours ────────────────────────────────────────────────
 * Un tarif à la nuitée peut porter un prix à la semaine (7 nuits) et un prix
 * au mois (30 nuits). Dès 7 nuits, la semaine s'applique à tout le séjour, au
 * prorata : 10 nuits à 630 000 F la semaine font 900 000 F. Dès 30 nuits, de
 * même pour le mois. Le client paie toujours **le moins cher** des calculs
 * possibles : un prix de semaine mal choisi ne lui coûte jamais plus que les
 * nuits une à une.
 *
 * Le serveur fait foi : la fiche refait le même calcul pour l'afficher
 * (`Ma-Villa/src/lib/prix.ts`), mais c'est ce montant-ci qui est réservé,
 * puis payé, puis réparti par `Commission`.
 */
final class PrixSejour
{
    public const NUITS_SEMAINE = 7;

    public const NUITS_MOIS = 30;

    /**
     * @return array{unites: int, montant: int, sans_reduction: int, prix_applique: 'unite'|'semaine'|'mois'}
     */
    public static function pour(Tarif $tarif, string $debut, string $fin): array
    {
        $unites = self::unites($tarif->type_tarif, $debut, $fin);
        $prix = (float) $tarif->prix;
        $sansReduction = (int) round($prix * $unites);

        $montant = $sansReduction;
        $applique = 'unite';

        if ($tarif->type_tarif === 'nuitee') {
            foreach ([
                'semaine' => [self::NUITS_SEMAINE, $tarif->prix_semaine],
                'mois'    => [self::NUITS_MOIS, $tarif->prix_mois],
            ] as $nom => [$seuil, $prixPeriode]) {
                if ($prixPeriode === null || $unites < $seuil) {
                    continue;
                }
                $candidat = (int) round($unites * $prixPeriode / $seuil);
                if ($candidat < $montant) {
                    $montant = $candidat;
                    $applique = $nom;
                }
            }
        }

        return [
            'unites'         => $unites,
            'montant'        => $montant,
            'sans_reduction' => $sansReduction,
            'prix_applique'  => $applique,
        ];
    }

    /** Nuits pour une nuitée (une au moins), jours bornes comprises pour le reste. */
    public static function unites(string $typeTarif, string $debut, string $fin): int
    {
        $ecart = (int) Carbon::parse($debut)->startOfDay()->diffInDays(Carbon::parse($fin)->startOfDay());

        return $typeTarif === 'nuitee' ? max($ecart, 1) : $ecart + 1;
    }
}
