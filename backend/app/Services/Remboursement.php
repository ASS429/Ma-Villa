<?php

namespace App\Services;

use App\Models\Paiement;
use Carbon\CarbonInterface;

/**
 * Ce qu'on rend au client, et pourquoi.
 *
 * Deux règles décidées par l'exploitant le 1er septembre 2026, et elles ne se
 * ressemblent pas :
 *
 *   — **la faute vient de nous ou du propriétaire** — logement indisponible,
 *     erreur de notre côté : remboursement **intégral, commission comprise**.
 *     Le client n'a pas à payer notre défaillance, et lui retenir 15 % pour
 *     un séjour qui n'a pas eu lieu de notre fait est le meilleur moyen de ne
 *     jamais le revoir ;
 *   — **le client se désiste** : le barème s'applique sur sa part, et la
 *     commission reste acquise au service rendu — la mise en relation a bien
 *     eu lieu, et l'encaissement a coûté des frais que le prestataire ne rend
 *     pas.
 *
 * ⚠️ Ce service **propose**. Il ne décide pas : l'écran affiche le montant qui
 * découle du barème et l'exploitant peut le corriger. Un cas particulier
 * existe toujours, et une règle qu'on ne peut pas contourner se contourne
 * hors du logiciel — donc sans trace.
 */
final class Remboursement
{
    public function __construct(
        public readonly int $montant,
        public readonly bool $commissionRendue,
        /** Ce qui explique le montant, en une phrase affichable. */
        public readonly string $explication,
    ) {}

    /**
     * @param 'plateforme'|'proprietaire'|'client' $imputeA
     */
    public static function proposer(Paiement $paiement, string $imputeA, ?CarbonInterface $arrivee = null): self
    {
        $total = (int) round((float) $paiement->montant);
        $partProprietaire = (int) round((float) $paiement->montant_proprietaire);
        $commission = $total - $partProprietaire;

        if ($imputeA !== 'client') {
            $qui = $imputeA === 'plateforme' ? 'la plateforme' : 'le propriétaire';

            return new self(
                montant: $total,
                commissionRendue: true,
                explication: "L'annulation est imputable à {$qui} : remboursement intégral, commission comprise.",
            );
        }

        // Le client se désiste : le barème s'applique, sur sa part seulement.
        $arrivee ??= $paiement->reservation?->date_debut
            ? \Carbon\Carbon::parse($paiement->reservation->date_debut)
            : null;

        [$part, $palier] = self::palier($arrivee);

        $rendu = (int) floor($partProprietaire * $part);
        $pourcentage = rtrim(rtrim(number_format($part * 100, 1, ',', ' '), '0'), ',');

        return new self(
            montant: $rendu,
            commissionRendue: false,
            explication: $palier === null
                ? "Le client se désiste, sans date d'arrivée connue : le barème ne peut pas s'appliquer, {$pourcentage} % de sa part est proposé par défaut."
                : "Le client se désiste {$palier}. Le barème rend {$pourcentage} % de sa part ; la commission de "
                  . number_format($commission, 0, ',', ' ') . " FCFA reste acquise.",
        );
    }

    /**
     * Le palier du barème, et de quoi l'expliquer.
     *
     * Les paliers se lisent du plus lointain au plus proche : le premier dont
     * le seuil est atteint gagne. Sans date d'arrivée, on retient le palier le
     * plus favorable au client — le doute ne doit pas jouer contre lui.
     *
     * @return array{0: float, 1: ?string}
     */
    private static function palier(?CarbonInterface $arrivee): array
    {
        $bareme = config('reservations.bareme_annulation', []);

        if ($bareme === []) {
            return [1.0, null];
        }

        if ($arrivee === null) {
            return [(float) $bareme[0]['part'], null];
        }

        // `startOfDay` des deux côtés : un séjour qui commence demain matin ne
        // doit pas compter zéro jour parce qu'on est le soir.
        $jours = (int) now()->startOfDay()->diffInDays($arrivee->copy()->startOfDay(), false);

        foreach ($bareme as $palier) {
            if ($jours >= (int) $palier['jours_avant']) {
                $seuil = (int) $palier['jours_avant'];

                return [
                    (float) $palier['part'],
                    $seuil > 0
                        ? "à {$jours} jours de l'arrivée"
                        : "à moins de deux jours de l'arrivée",
                ];
            }
        }

        // Arrivée passée : le séjour aurait dû avoir lieu.
        return [(float) end($bareme)['part'], 'après la date d\'arrivée'];
    }
}
