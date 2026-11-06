<?php

namespace App\Services;

use App\Models\DemandeService;
use App\Models\Paiement;
use App\Models\Reservation;

/**
 * Ce que PasseTemps tient pour le compte des autres, et doit donc laisser où il est.
 *
 * L'exploitant n'a pas de compte bancaire d'entreprise (5 novembre 2026) : la commission part
 * sur son compte personnel, et c'est la seule chose qui doit en partir. Ce calcul dit, pour un
 * retrait, la somme sous laquelle il ne faut jamais descendre.
 *
 * Séparé selon l'endroit où est l'argent : un règlement reçu à la main (Wave, espèces) n'est
 * pas sur le compte PayDunya, et le compter dedans ferait croire qu'il manque de l'argent.
 */
final class Fonds
{
    /**
     * @return array{proprietaires: int, associes: int, remboursements: int, transporteurs: int, total: int}
     */
    public static function aGarder(bool $horsLigne): array
    {
        // Une décision de remboursement attend : tout ce que le client a payé peut lui revenir,
        // commission comprise. On le garde en entier, et il ne compte pas une seconde fois ailleurs.
        $enAttente = Reservation::attendUneDecisionDeRemboursement()->pluck('id');

        $base = fn () => Paiement::query()->abouti()
            ->where('hors_ligne', $horsLigne)
            ->whereNotIn('reservation_id', $enAttente);

        // Trois états qui ne se recouvrent pas : séjour fini et soldé, séjour à venir, solde attendu.
        $proprietaires = (float) $base()->exigible()->sum('montant_proprietaire')
            + (float) $base()->aVenir()->sum('montant_proprietaire')
            + (float) $base()->retenuFauteDeSolde()->sum('montant_proprietaire');

        // Ce qui revient aux associés, acompte compris : il n'est pas à nous non plus.
        $associes = $base()->where('circuit', 'associe')->whereNull('transmis_le')
            ->where(fn ($p) => $p
                ->whereHas('reservation', fn ($r) => $r->where('statut', '!=', 'annulee'))
                ->orWhereNotNull('part_avant_remboursement'))
            ->get()
            ->sum(fn (Paiement $p) => max(0, $p->aTransmettre()));

        $remboursements = Paiement::query()->abouti()
            ->where('hors_ligne', $horsLigne)
            ->whereIn('reservation_id', $enAttente)
            ->whereNull('reversement_id')
            ->whereNull('transmis_le')
            ->get()
            ->sum(fn (Paiement $p) => max(0, (int) round((float) $p->montant - (float) $p->rendu_au_client)));

        $proprietaires = (int) round($proprietaires);

        // La part du transporteur d'un trajet que le client nous a payé, tant qu'elle ne lui
        // est pas reversée. Un service se règle toujours à la main : jamais sur PayDunya.
        $transporteurs = $horsLigne ? (int) DemandeService::query()->aReverser()->sum('part_prestataire') : 0;

        return [
            'proprietaires'  => $proprietaires,
            'associes'       => (int) $associes,
            'remboursements' => (int) $remboursements,
            'transporteurs'  => $transporteurs,
            'total'          => $proprietaires + (int) $associes + (int) $remboursements + $transporteurs,
        ];
    }
}
