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
 * Deux taux selon le montant. Le seuil est en francs et non par catégorie :
 * une règle par catégorie devrait être rouverte à chaque nouvelle catégorie,
 * alors qu'un seuil vaut pour toutes, y compris celles qui n'existent pas encore.
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

        $taux = $client >= (int) config('paiement.commission.seuil')
            ? (float) config('paiement.commission.taux_eleve')
            : (float) config('paiement.commission.taux_reduit');

        // La commission est arrondie à l'inférieur : à francs égaux, le doute
        // profite au propriétaire, et la somme des deux parts reste exacte.
        $commission = (int) floor($client * $taux);

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
