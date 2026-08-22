<?php

namespace Tests\Unit;

use App\Services\Commission;
use Tests\TestCase;

/**
 * Le barème de commission.
 *
 * Un seul test compte vraiment ici — la monotonie. Les autres vérifient des
 * valeurs, celui-là vérifie une **propriété** : quel que soit le barème qu'on
 * choisira demain, augmenter son prix ne doit jamais faire baisser ce que
 * touche le propriétaire.
 */
class CommissionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'paiement.commission.seuil'       => 50000,
            'paiement.commission.taux_reduit' => 0.10,
            'paiement.commission.taux_eleve'  => 0.20,
        ]);
    }

    /**
     * **Le test qui a motivé le changement.**
     *
     * En taux pleins, franchir 50 000 faisait perdre 3 300 FCFA au
     * propriétaire : 44 100 à 49 000, puis 40 800 à 51 000. Un tarif qui punit
     * celui qui monte en gamme finit par être contourné hors plateforme.
     */
    public function test_le_proprietaire_ne_perd_jamais_en_augmentant_son_prix(): void
    {
        $precedent = -1;

        // Autour du seuil au franc près, puis par pas plus larges.
        $montants = array_merge(
            range(49_000, 51_000, 1),
            range(52_000, 500_000, 1_000),
        );

        foreach ($montants as $montant) {
            $part = Commission::pour($montant)->montantProprietaire;

            $this->assertGreaterThanOrEqual(
                $precedent,
                $part,
                "À {$montant} FCFA, le propriétaire touche moins qu'au montant précédent."
            );

            $precedent = $part;
        }
    }

    public function test_sous_le_seuil_le_taux_reduit_s_applique_entierement(): void
    {
        $c = Commission::pour(40000);

        $this->assertSame(4000, $c->commission);
        $this->assertSame(36000, $c->montantProprietaire);
    }

    /** Au seuil exact, on est encore entièrement dans la première tranche. */
    public function test_au_seuil_exact(): void
    {
        $c = Commission::pour(50000);

        $this->assertSame(5000, $c->commission);
        $this->assertSame(45000, $c->montantProprietaire);
    }

    /** Au-delà, seule la part excédentaire passe au taux élevé. */
    public function test_au_dela_seule_la_tranche_haute_est_au_taux_eleve(): void
    {
        // 50 000 à 10 % = 5 000, puis 50 000 à 20 % = 10 000.
        $c = Commission::pour(100000);

        $this->assertSame(15000, $c->commission);
        $this->assertSame(85000, $c->montantProprietaire);
    }

    /**
     * Le taux enregistré est le taux **effectif** : c'est celui qu'on peut
     * expliquer au propriétaire en lisant une ligne passée.
     */
    public function test_le_taux_enregistre_est_le_taux_effectif(): void
    {
        $this->assertSame('15 %', Commission::pour(100000)->tauxLisible());
        $this->assertSame('17,5 %', Commission::pour(200000)->tauxLisible());
        $this->assertSame('10 %', Commission::pour(30000)->tauxLisible());
    }

    /**
     * Ce que le barème coûte à la plateforme est **borné** : le rabais de la
     * première tranche, et rien de plus. C'est le chiffre à connaître avant de
     * décider.
     */
    public function test_le_manque_a_gagner_est_plafonne_a_5000(): void
    {
        foreach ([51_000, 80_000, 150_000, 400_000, 2_000_000] as $montant) {
            $tranches = Commission::pour($montant)->commission;
            $tauxPlein = (int) floor($montant * 0.20);

            $this->assertLessThanOrEqual(
                5000,
                $tauxPlein - $tranches,
                "À {$montant} FCFA, l'écart avec le taux plein dépasse 5 000."
            );
        }
    }

    /** Les deux parts doivent toujours redonner exactement ce que paie le client. */
    public function test_les_deux_parts_somment_toujours_au_montant_client(): void
    {
        foreach ([1, 199, 49_999, 50_000, 50_001, 123_457, 999_999] as $montant) {
            $c = Commission::pour($montant);

            $this->assertSame(
                $montant,
                $c->commission + $c->montantProprietaire,
                "À {$montant} FCFA, un franc se perd dans l'arrondi."
            );
        }
    }

    public function test_un_montant_nul_ne_produit_aucune_commission(): void
    {
        $c = Commission::pour(0);

        $this->assertSame(0, $c->commission);
        $this->assertSame(0, $c->montantProprietaire);
    }
}
