<?php

namespace Tests\Unit;

use App\Services\Commission;
use Tests\TestCase;

class CommissionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'paiement.commission.taux_eleve'  => 0.20,
            'paiement.commission.taux_reduit' => 0.10,
            'paiement.commission.seuil'       => 50000,
        ]);
    }

    public function test_une_grosse_reservation_paie_le_taux_eleve(): void
    {
        $c = Commission::pour(200000);

        $this->assertEquals(0.20, $c->taux);
        $this->assertEquals(40000, $c->commission);
        $this->assertEquals(160000, $c->montantProprietaire);
    }

    public function test_une_petite_reservation_paie_le_taux_reduit(): void
    {
        $c = Commission::pour(20000);

        $this->assertEquals(0.10, $c->taux);
        $this->assertEquals(2000, $c->commission);
        $this->assertEquals(18000, $c->montantProprietaire);
    }

    public function test_le_seuil_est_inclusif(): void
    {
        // Pile au seuil : taux élevé. Un franc en dessous : taux réduit.
        $this->assertEquals(0.20, Commission::pour(50000)->taux);
        $this->assertEquals(0.10, Commission::pour(49999)->taux);
    }

    public function test_la_commission_ne_s_ajoute_pas_au_prix_affiche(): void
    {
        // Le client paie exactement le prix de l'annonce : les deux parts
        // s'additionnent pour retomber dessus, jamais au-dessus.
        $c = Commission::pour(85000);

        $this->assertEquals(85000, $c->montantClient);
        $this->assertEquals(85000, $c->commission + $c->montantProprietaire);
    }

    public function test_les_deux_parts_se_somment_toujours_exactement(): void
    {
        // L'arrondi ne doit jamais faire apparaître ou disparaître un franc.
        foreach ([1, 7, 999, 49999, 50000, 123457, 1000001] as $montant) {
            $c = Commission::pour($montant);
            $this->assertEquals(
                $montant,
                $c->commission + $c->montantProprietaire,
                "La répartition de {$montant} FCFA ne retombe pas juste"
            );
        }
    }

    public function test_l_arrondi_profite_au_proprietaire(): void
    {
        // 12 345 × 10 % = 1 234,5 → la plateforme prend 1 234, pas 1 235.
        $c = Commission::pour(12345);

        $this->assertEquals(1234, $c->commission);
        $this->assertEquals(11111, $c->montantProprietaire);
    }

    public function test_un_montant_nul_ou_negatif_ne_produit_aucune_commission(): void
    {
        foreach ([0, -1, -50000] as $montant) {
            $c = Commission::pour($montant);
            $this->assertEquals(0, $c->commission);
            $this->assertEquals(0, $c->montantProprietaire);
        }
    }

    public function test_un_montant_decimal_est_ramene_au_franc(): void
    {
        // Les tarifs sont stockés en decimal(10,2) : « 85000.00 » arrive en chaîne.
        $c = Commission::pour('85000.00');

        $this->assertEquals(85000, $c->montantClient);
        $this->assertEquals(17000, $c->commission);
    }

    public function test_le_taux_est_lisible_pour_l_affichage(): void
    {
        $this->assertEquals('20 %', Commission::pour(100000)->tauxLisible());
        $this->assertEquals('10 %', Commission::pour(10000)->tauxLisible());
    }

    public function test_les_taux_restent_pilotes_par_la_configuration(): void
    {
        // Le barème n'est pas arrêté : il doit pouvoir changer sans toucher au code.
        config(['paiement.commission.taux_eleve' => 0.15, 'paiement.commission.seuil' => 100000]);

        $this->assertEquals(0.15, Commission::pour(150000)->taux);
        $this->assertEquals(0.10, Commission::pour(99999)->taux);
    }
}
