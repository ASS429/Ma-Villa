<?php

namespace Tests\Unit;

use App\Services\Commission;
use Tests\TestCase;

/**
 * Le barème de commission.
 *
 * Deux tests comptent vraiment ici, et ce sont deux **propriétés**, pas des
 * valeurs : augmenter son prix ne doit jamais faire baisser ce que touche le
 * propriétaire, et notre taux doit rester sous celui de Booking à tout montant.
 * Les autres vérifient des chiffres, que le prochain barème changera.
 */
class CommissionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'paiement.commission.seuil'       => 50000,
            'paiement.commission.taux_reduit' => 0.10,
            'paiement.commission.taux_eleve'  => 0.14,
        ]);
    }

    /**
     * **Le test qui a motivé les tranches.**
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

    /**
     * **La promesse du 10 septembre 2026** : notre commission reste sous celle
     * de Booking, qui prend 15 % en moyenne — à tout montant, y compris sur les
     * longs séjours en villa, où l'ancien taux élevé de 20 % la dépassait.
     *
     * Lu sur le barème **livré dans le dépôt**, pas sur celui que fixe `setUp()` :
     * c'est la valeur par défaut qu'on protège ici. Une variable Railway peut
     * encore la remplacer en production — `/api/configuration` expose le barème
     * réellement appliqué pour qu'on puisse le vérifier.
     */
    public function test_la_commission_reste_sous_booking_a_tout_montant(): void
    {
        config(['paiement.commission' => (require config_path('paiement.php'))['commission']]);

        $booking = 0.15;

        // Le taux **affiché** d'abord. Le taux effectif seul ne suffit pas : c'est
        // une moyenne avec le taux réduit, il reste sous 15 % même avec un taux
        // élevé à 15 % pile — mesuré. Or les CGU publient le taux élevé en toutes
        // lettres, et « 15 % » n'est pas « plus bas que Booking » pour qui le lit.
        $this->assertLessThan(
            $booking,
            (float) config('paiement.commission.taux_eleve'),
            'Le taux élevé, publié tel quel dans les CGU, doit être sous les 15 % de Booking.'
        );

        foreach ([1_000, 49_999, 50_000, 50_001, 100_000, 160_000, 320_000, 2_000_000, 50_000_000] as $montant) {
            $taux = Commission::pour($montant)->taux;

            $this->assertLessThan(
                $booking,
                $taux,
                "À {$montant} FCFA, notre taux effectif ({$taux}) atteint ou dépasse les 15 % de Booking."
            );
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
        // 50 000 à 10 % = 5 000, puis 50 000 à 14 % = 7 000.
        $c = Commission::pour(100000);

        $this->assertSame(12000, $c->commission);
        $this->assertSame(88000, $c->montantProprietaire);
    }

    /**
     * Le taux enregistré est le taux **effectif** : c'est celui qu'on peut
     * expliquer au propriétaire en lisant une ligne passée.
     */
    public function test_le_taux_enregistre_est_le_taux_effectif(): void
    {
        $this->assertSame('12 %', Commission::pour(100000)->tauxLisible());
        $this->assertSame('13 %', Commission::pour(200000)->tauxLisible());
        $this->assertSame('10 %', Commission::pour(30000)->tauxLisible());
    }

    /**
     * Ce que les tranches coûtent à la plateforme est **borné** : le rabais de
     * la première tranche, soit le seuil multiplié par l'écart entre les deux
     * taux. Calculé depuis le barème plutôt qu'écrit en dur : ce plafond valait
     * 5 000 à 20 %, il vaut 2 000 à 14 %, et il changera avec le prochain.
     */
    public function test_le_manque_a_gagner_est_plafonne_au_rabais_de_la_premiere_tranche(): void
    {
        $seuil  = (int) config('paiement.commission.seuil');
        $reduit = (float) config('paiement.commission.taux_reduit');
        $eleve  = (float) config('paiement.commission.taux_eleve');

        $plafond = (int) round($seuil * ($eleve - $reduit));

        foreach ([51_000, 80_000, 150_000, 400_000, 2_000_000] as $montant) {
            $tranches = Commission::pour($montant)->commission;
            $tauxPlein = (int) floor($montant * $eleve);

            $this->assertLessThanOrEqual(
                $plafond,
                $tauxPlein - $tranches,
                "À {$montant} FCFA, l'écart avec le taux plein dépasse {$plafond}."
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
