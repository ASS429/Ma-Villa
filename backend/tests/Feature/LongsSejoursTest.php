<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use App\Services\PrixSejour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Les séjours de plusieurs jours : prix à la semaine et au mois, durée
 * minimale, et le compte juste des formules de jour.
 *
 * Ce que ces tests protègent : le client ne paie jamais plus que les nuits une
 * à une, et le montant réservé est celui que la fiche lui a montré.
 */
class LongsSejoursTest extends TestCase
{
    use RefreshDatabase;

    private function logement(array $attributs = []): Logement
    {
        $proprietaire = User::factory()->proprietaire()->create();
        $villa = Villa::factory()->validee()->create(['user_id' => $proprietaire->id]);

        return Logement::create($attributs + [
            'villa_id'   => $villa->id,
            'nom'        => 'Studio présidentiel',
            'type'       => 'studio',
            'capacite'   => 2,
            'disponible' => true,
        ]);
    }

    private function tarif(Logement $logement, array $attributs = []): Tarif
    {
        return Tarif::create($attributs + [
            'logement_id' => $logement->id,
            'type_tarif'  => 'nuitee',
            'prix'        => 100000,
            'avec_clim'   => false,
            'avec_buffet' => false,
        ]);
    }

    private function jour(int $dansNJours): string
    {
        return now()->addDays($dansNJours)->toDateString();
    }

    private function reserver(Logement $logement, Tarif $tarif, int $arrivee, int $depart)
    {
        return $this->actingAs(User::factory()->client()->create(), 'sanctum')
            ->postJson('/api/reservations', [
                'logement_id'  => $logement->id,
                'tarif_id'     => $tarif->id,
                'date_debut'   => $this->jour($arrivee),
                'date_fin'     => $this->jour($depart),
                'nb_personnes' => 1,
            ]);
    }

    /* ── Le calcul ───────────────────────────────────────────────── */

    public function test_une_nuitee_se_compte_en_nuits_et_une_formule_de_jour_en_jours(): void
    {
        $this->assertSame(2, PrixSejour::unites('nuitee', '2026-11-06', '2026-11-08'), 'vendredi → dimanche');
        $this->assertSame(1, PrixSejour::unites('nuitee', '2026-11-06', '2026-11-06'), 'arrivée et départ le même jour');
        $this->assertSame(3, PrixSejour::unites('journee', '2026-11-02', '2026-11-04'), 'lundi → mercredi');
        $this->assertSame(1, PrixSejour::unites('demi_journee', '2026-11-02', '2026-11-02'));
        $this->assertSame(2, PrixSejour::unites('pass', '2026-11-02', '2026-11-03'));
    }

    public function test_la_semaine_s_applique_des_sept_nuits_a_tout_le_sejour(): void
    {
        $tarif = $this->tarif($this->logement(), ['prix_semaine' => 560000]);

        $six = PrixSejour::pour($tarif, '2026-11-01', '2026-11-07');
        $this->assertSame(600000, $six['montant'], 'six nuits : à l’unité');
        $this->assertSame('unite', $six['prix_applique']);

        $dix = PrixSejour::pour($tarif, '2026-11-01', '2026-11-11');
        $this->assertSame(800000, $dix['montant'], 'dix nuits au prorata de 560 000 F la semaine');
        $this->assertSame(1000000, $dix['sans_reduction']);
        $this->assertSame('semaine', $dix['prix_applique']);
    }

    public function test_le_mois_s_applique_des_trente_nuits_et_le_moins_cher_l_emporte(): void
    {
        $tarif = $this->tarif($this->logement(), ['prix_semaine' => 560000, 'prix_mois' => 1800000]);

        $trente = PrixSejour::pour($tarif, '2026-11-01', '2026-12-01');
        $this->assertSame(1800000, $trente['montant']);
        $this->assertSame('mois', $trente['prix_applique']);

        // 45 nuits : 3 600 000 F à la semaine, 2 700 000 F au mois.
        $this->assertSame(2700000, PrixSejour::pour($tarif, '2026-11-01', '2026-12-16')['montant']);
    }

    public function test_un_prix_de_semaine_plus_cher_que_sept_nuits_n_est_jamais_applique(): void
    {
        // Posé directement : le formulaire le refuse, mais une donnée ancienne
        // ou importée ne doit pas coûter plus cher au client.
        $tarif = $this->tarif($this->logement(), ['prix_semaine' => 800000]);

        $sept = PrixSejour::pour($tarif, '2026-11-01', '2026-11-08');
        $this->assertSame(700000, $sept['montant']);
        $this->assertSame('unite', $sept['prix_applique']);
    }

    public function test_la_semaine_ne_touche_pas_une_formule_de_jour(): void
    {
        $tarif = $this->tarif($this->logement(), ['type_tarif' => 'journee', 'prix' => 20000]);

        $this->assertSame(60000, PrixSejour::pour($tarif, '2026-11-02', '2026-11-04')['montant']);
    }

    /* ── La réservation ──────────────────────────────────────────── */

    public function test_la_reservation_porte_le_prix_de_la_semaine(): void
    {
        $logement = $this->logement();
        $tarif = $this->tarif($logement, ['prix_semaine' => 560000]);

        $this->reserver($logement, $tarif, 5, 15)
            ->assertCreated()
            ->assertJsonPath('montant_total', fn ($m) => (float) $m === 800000.0);
    }

    public function test_une_journee_sur_trois_jours_compte_trois_jours(): void
    {
        $logement = $this->logement();
        $tarif = $this->tarif($logement, ['type_tarif' => 'journee', 'prix' => 20000]);

        $this->reserver($logement, $tarif, 5, 7)
            ->assertCreated()
            ->assertJsonPath('montant_total', fn ($m) => (float) $m === 60000.0);
    }

    public function test_la_duree_minimale_refuse_un_sejour_trop_court(): void
    {
        $logement = $this->logement(['nuits_minimum' => 3]);
        $tarif = $this->tarif($logement);

        $this->reserver($logement, $tarif, 5, 7)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('date_fin')
            ->assertJsonPath('message', 'Ce logement se réserve pour 3 nuits au moins.');

        $this->reserver($logement, $tarif, 5, 8)->assertCreated();
    }

    public function test_la_duree_minimale_ne_vise_que_la_nuitee(): void
    {
        $logement = $this->logement(['nuits_minimum' => 3]);
        $journee = $this->tarif($logement, ['type_tarif' => 'journee', 'prix' => 20000]);

        $this->reserver($logement, $journee, 5, 5)->assertCreated();
    }

    /* ── Ce que le propriétaire peut poser ───────────────────────── */

    public function test_le_proprietaire_pose_ses_prix_de_semaine_et_de_mois(): void
    {
        $logement = $this->logement();
        $proprietaire = $logement->villa->proprietaire ?? User::find($logement->villa->user_id);

        $this->actingAs($proprietaire, 'sanctum')
            ->postJson("/api/logements/{$logement->id}/tarifs", [
                'type_tarif' => 'nuitee', 'prix' => 95000,
                'prix_semaine' => 630000, 'prix_mois' => 2550000,
            ])
            ->assertCreated()
            ->assertJsonPath('prix_semaine', 630000)
            ->assertJsonPath('prix_mois', 2550000);

        $this->actingAs($proprietaire, 'sanctum')
            ->putJson("/api/villas/{$logement->villa_id}/logements/{$logement->id}", [
                'nom' => $logement->nom, 'type' => 'studio', 'capacite' => 2, 'nuits_minimum' => 3,
            ])
            ->assertOk();
        $this->assertSame(3, $logement->fresh()->nuits_minimum);
    }

    public function test_un_prix_de_semaine_absurde_ou_hors_nuitee_est_refuse(): void
    {
        $logement = $this->logement();
        $proprietaire = User::find($logement->villa->user_id);

        // Plus cher que sept nuits : il ne serait jamais appliqué.
        $this->actingAs($proprietaire, 'sanctum')
            ->postJson("/api/logements/{$logement->id}/tarifs", [
                'type_tarif' => 'nuitee', 'prix' => 50000, 'prix_semaine' => 400000,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('prix_semaine');

        // Une semaine de demi-journées ne veut rien dire.
        $this->actingAs($proprietaire, 'sanctum')
            ->postJson("/api/logements/{$logement->id}/tarifs", [
                'type_tarif' => 'demi_journee', 'prix' => 10000, 'prix_mois' => 200000,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('prix_mois');

        // « 4 » saisi pour « 40 000 » : un prix sous le plancher est une faute de frappe.
        $this->actingAs($proprietaire, 'sanctum')
            ->postJson("/api/logements/{$logement->id}/tarifs", ['type_tarif' => 'nuitee', 'prix' => 4])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('prix');
        $this->actingAs($proprietaire, 'sanctum')
            ->postJson("/api/logements/{$logement->id}/tarifs", [
                'type_tarif' => 'nuitee', 'prix' => 50000, 'prix_semaine' => 4, 'prix_mois' => 4,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['prix_semaine', 'prix_mois']);

        // Sans prix de séjour, rien ne change : l'application mobile ne les envoie pas.
        $this->actingAs($proprietaire, 'sanctum')
            ->postJson("/api/logements/{$logement->id}/tarifs", ['type_tarif' => 'nuitee', 'prix' => 50000])
            ->assertCreated()
            ->assertJsonPath('prix_semaine', null);
    }
}
