<?php

namespace App\Services;

/**
 * Répartition d'une réservation entre la plateforme et le propriétaire.
 *
 * La commission est **prélevée sur ce que paie le client**, jamais ajoutée
 * par-dessus : le montant affiché sur l'annonce est celui qui sera débité, et
 * le propriétaire touche la différence. Afficher un prix puis en facturer un
 * autre est le meilleur moyen de perdre un premier client.
 *
 * **Par tranches, comme un barème d'imposition.** Les premiers francs sont
 * commissionnés au taux réduit, ceux au-delà du seuil au taux élevé.
 *
 * Le barème à deux taux pleins créait une marche absurde : à 49 000 FCFA le
 * propriétaire touchait 44 100, à 51 000 il touchait 40 800. Augmenter son prix
 * de 2 000 lui coûtait 3 300 — un tarif qui punit celui qui monte en gamme finit
 * par être contourné hors plateforme.
 *
 * Ce que cela change pour la plateforme : **5 000 FCFA au maximum par
 * réservation**, soit le rabais de la première tranche. L'écart se dilue à
 * mesure que le montant grandit — 15 % de taux effectif à 100 000, 17,5 % à
 * 200 000, et la courbe tend vers 20 %.
 *
 * Le seuil est en francs et non par catégorie : une règle par catégorie devrait
 * être rouverte à chaque nouvelle catégorie, alors qu'un seuil vaut pour toutes,
 * y compris celles qui n'existent pas encore.
 */
final class Commission
{
    public function __construct(
        public readonly int $montantClient,
        public readonly float $taux,
        public readonly int $commission,
        public readonly int $montantProprietaire,
    ) {}

    public static function pour(int|float|string $montantClient): self
    {
        // Le FCFA n'a pas de subdivision : tout se raisonne en unités entières.
        $client = (int) round((float) $montantClient);

        if ($client <= 0) {
            return new self(0, 0.0, 0, 0);
        }

        $seuil  = (int) config('paiement.commission.seuil');
        $reduit = (float) config('paiement.commission.taux_reduit');
        $eleve  = (float) config('paiement.commission.taux_eleve');

        // La commission est arrondie à l'inférieur : à francs égaux, le doute
        // profite au propriétaire, et la somme des deux parts reste exacte.
        $commission = $client <= $seuil
            ? (int) floor($client * $reduit)
            : (int) floor($seuil * $reduit + ($client - $seuil) * $eleve);

        // Le taux enregistré est le taux **effectif**, celui qu'on peut
        // expliquer au propriétaire : « 15 % » sur 100 000. Enregistrer un taux
        // de barème obligerait à refaire le calcul pour lire une ligne passée.
        $taux = $commission / $client;

        return new self($client, $taux, $commission, $client - $commission);
    }

    /** Pourcentage lisible, pour l'affichage et les journaux : « 20 % ». */
    public function tauxLisible(): string
    {
        return rtrim(rtrim(number_format($this->taux * 100, 1, ',', ' '), '0'), ',').' %';
    }

    public function toArray(): array
    {
        return [
            'montant_client'       => $this->montantClient,
            'taux_commission'      => $this->taux,
            'commission'           => $this->commission,
            'montant_proprietaire' => $this->montantProprietaire,
        ];
    }
}
