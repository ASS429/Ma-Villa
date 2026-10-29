<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Paiement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use App\Services\Commission;
use App\Services\ImportCleDor;
use App\Services\Majoration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Le circuit des associés, pendant les JOJ : prix majoré de notre part,
 * 10 % de cette part pour PasseTemps, le reste transmis aux associés à
 * chaque paiement — et jamais reversé une seconde fois au propriétaire.
 */
class CircuitDesAssociesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'paiement.actif' => true,
            'paiement.paydunya.cle_maitre'   => 'maitre',
            'paiement.paydunya.cle_privee'   => 'privee',
            'paiement.paydunya.cle_publique' => 'publique',
            'paiement.paydunya.token'        => 'jeton',
            'paiement.commission.taux_eleve'  => 0.14,
            'paiement.commission.taux_reduit' => 0.10,
            'paiement.commission.seuil'       => 50000,
            'paiement.associes.majoration'      => 0.14,
            'paiement.associes.part_passetemps' => 0.10,
        ]);
        $this->admin = User::factory()->create(['role' => 'admin']);
    }

    private function annonce(int $prix, bool $associes = true, ?User $proprietaire = null): Villa
    {
        $villa = Villa::factory()->validee()->create([
            'user_id' => ($proprietaire ?? User::factory()->proprietaire()->create())->id,
            'description' => 'Tarifs : 50 000 F la nuitée · 1 000 000 F le mois. Au 4e étage, 2 000 m du rond-point.',
        ]);
        $logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Appartement', 'type' => 'appartement',
            'capacite' => 6, 'disponible' => true,
        ]);
        Tarif::create([
            'logement_id' => $logement->id, 'type_tarif' => 'nuitee',
            'prix' => $prix, 'avec_clim' => true, 'avec_buffet' => false,
        ]);

        if ($associes) {
            Majoration::appliquer($villa);
        }

        return $villa->fresh();
    }

    private function reservation(Villa $villa, int $nuits = 1, string $statut = 'confirmee'): Reservation
    {
        $logement = $villa->logements()->first();
        $tarif = $logement->tarifs()->first();

        return Reservation::create([
            'user_id' => User::factory()->client()->create()->id,
            'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
            'date_debut' => now()->addDays(3)->toDateString(),
            'date_fin' => now()->addDays(3 + $nuits)->toDateString(),
            'nb_personnes' => 2, 'montant_total' => (int) $tarif->prix * $nuits, 'statut' => $statut,
        ]);
    }

    private function paye(Reservation $reservation): Paiement
    {
        $villa = $reservation->logement->villa;
        $paiement = new Paiement([
            'reservation_id' => $reservation->id, 'methode' => 'wave',
            'statut' => 'reussi', 'paye_le' => now(), 'reference' => 'MV-'.$reservation->id,
        ]);
        $paiement->appliquerRepartition(
            Commission::pour($reservation->montant_total, $villa->passeParLesAssocies() ? $villa->majoration : null),
            $villa->circuit,
        );
        $paiement->save();

        return $paiement->refresh();
    }

    /* ── Le prix et la répartition ───────────────────────────── */

    public function test_le_prix_affiche_comprend_notre_part_arrondie_aux_500_francs(): void
    {
        $this->assertSame(57000, Majoration::prix(50000, 0.14));
        $this->assertSame(125500, Majoration::prix(110000, 0.14));
        $this->assertSame(40000, Majoration::prix(35000, 0.14));
        $this->assertSame(91500, Majoration::prix(80000, 0.14));
    }

    public function test_le_proprietaire_retrouve_son_prix_exact_quelle_que_soit_la_duree(): void
    {
        $une = Commission::pour(57000, 0.14);
        $this->assertSame(50000, $une->montantProprietaire);
        $this->assertSame(7000, $une->commission);

        // Le barème par tranches lui aurait retiré 7 200 F sur cinq nuits.
        $cinq = Commission::pour(285000, 0.14);
        $this->assertSame(250000, $cinq->montantProprietaire);

        // L'arrondi aux 500 F lui profite : il touche un peu plus que demandé.
        $this->assertGreaterThanOrEqual(110000, Commission::pour(125500, 0.14)->montantProprietaire);
    }

    public function test_les_prix_de_la_description_sont_majores_et_le_reste_du_texte_non(): void
    {
        $texte = Majoration::texte(
            "Tarifs : 200 000 F la nuitée · 3 000 000 F le mois.\n• 95 000 / 90 000 / 85 000 F\nAu 4e étage, 2 000 m de la plage.",
            0.14,
        );

        $this->assertStringContainsString('228 000 F la nuitée · 3 420 000 F le mois', $texte);
        $this->assertStringContainsString('108 500 / 103 000 / 97 000 F', $texte);
        $this->assertStringContainsString('Au 4e étage, 2 000 m de la plage.', $texte);
    }

    public function test_une_annonce_n_est_jamais_majoree_deux_fois(): void
    {
        $villa = $this->annonce(50000);

        $this->assertFalse(Majoration::appliquer($villa));
        $this->assertSame(57000, (int) $villa->logements()->first()->tarifs()->first()->prix);
        $this->assertSame('associe', $villa->circuit);
        $this->assertStringContainsString('57 000 F la nuitée · 1 140 000 F le mois', $villa->description);
    }

    public function test_le_paiement_fige_le_circuit_et_notre_part(): void
    {
        Http::fake([
            '*checkout-invoice/create' => Http::response(['response_code' => '00', 'response_text' => 'u', 'token' => 'JETON']),
            '*softpay/wave-senegal' => Http::response(['success' => true, 'url' => 'https://pay.wave.com/c/x']),
        ]);
        $reservation = $this->reservation($this->annonce(50000));

        $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '+221 77 123 45 67',
            ])->assertOk();

        $this->assertDatabaseHas('paiements', [
            'reservation_id' => $reservation->id, 'montant' => 57000,
            'commission' => 7000, 'montant_proprietaire' => 50000,
            'circuit' => 'associe', 'part_passetemps' => 700,
        ]);
    }

    public function test_une_annonce_ordinaire_garde_le_bareme_et_le_circuit_direct(): void
    {
        $paiement = $this->paye($this->reservation($this->annonce(200000, associes: false)));

        $this->assertSame('direct', $paiement->circuit);
        $this->assertSame(26000, (int) $paiement->commission);
        $this->assertNull($paiement->part_passetemps);
    }

    /* ── Ce qui est transmis, et ce qui ne l'est jamais deux fois ─── */

    public function test_l_argent_des_associes_n_est_jamais_du_au_proprietaire(): void
    {
        $paiement = $this->paye($this->reservation($this->annonce(50000)));

        // Séjour à venir : rien « à venir » pour le propriétaire.
        $this->assertFalse(Paiement::query()->aVenir()->exists());
        $this->assertTrue(Paiement::query()->aTransmettre()->whereKey($paiement->id)->exists());
        $this->assertSame(56300, $paiement->aTransmettre());

        // Séjour terminé : toujours rien d'exigible, même transmis.
        $paiement->reservation->update([
            'date_debut' => now()->subDays(3)->toDateString(),
            'date_fin' => now()->subDay()->toDateString(),
        ]);
        $paiement->forceFill(['transmis_le' => now(), 'transmis_montant' => 55000])->save();
        $this->assertFalse(Paiement::query()->exigible()->exists());
    }

    public function test_la_console_note_une_transmission_une_seule_fois(): void
    {
        $paiement = $this->paye($this->reservation($this->annonce(50000)));

        $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/transmissions')
            ->assertOk()
            ->assertJsonPath('a_transmettre.0.a_transmettre', 56300)
            ->assertJsonPath('totaux.part_passetemps', 700);

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/paiements/{$paiement->id}/transmission", ['montant' => 60000])
            ->assertStatus(422);

        // Frais PayDunya déduits : c'est ce qui est vraiment parti qui compte.
        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/paiements/{$paiement->id}/transmission", ['montant' => 55000, 'reference' => 'W-1'])
            ->assertOk();

        $this->assertDatabaseHas('paiements', ['id' => $paiement->id, 'transmis_montant' => 55000, 'transmis_reference' => 'W-1']);
        $this->assertDatabaseHas('journal_admin', ['action' => 'associes.transmission']);

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/paiements/{$paiement->id}/transmission", ['montant' => 55000])
            ->assertStatus(409);
    }

    public function test_un_paiement_direct_ne_se_transmet_pas(): void
    {
        $paiement = $this->paye($this->reservation($this->annonce(50000, associes: false)));

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/admin/paiements/{$paiement->id}/transmission", ['montant' => 1000])
            ->assertStatus(409);
    }

    public function test_une_reservation_annulee_attend_le_remboursement_pas_la_transmission(): void
    {
        $paiement = $this->paye($this->reservation($this->annonce(50000)));
        $paiement->reservation->update(['statut' => 'annulee']);

        $this->assertFalse(Paiement::query()->aTransmettre()->exists());
    }

    public function test_seul_l_admin_voit_et_note_les_transmissions(): void
    {
        $villa = $this->annonce(50000);
        $paiement = $this->paye($this->reservation($villa));

        $this->actingAs($villa->proprietaire, 'sanctum')->getJson('/api/admin/transmissions')->assertForbidden();
        $this->actingAs($villa->proprietaire, 'sanctum')
            ->patchJson("/api/admin/paiements/{$paiement->id}/transmission", ['montant' => 1000])
            ->assertForbidden();
    }

    public function test_ce_qui_attend_signale_la_transmission_et_les_demandes(): void
    {
        $villa = $this->annonce(50000);
        $this->paye($this->reservation($villa));
        $this->reservation($villa, statut: 'en_attente');

        $cles = collect($this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/attentes')
            ->assertOk()->json('lignes'))->pluck('cle');

        $this->assertContains('transmissions', $cles);
        $this->assertContains('demandes_reservation', $cles);
    }

    /* ── La console répond aux demandes ──────────────────────── */

    public function test_l_admin_voit_les_demandes_et_les_confirme(): void
    {
        $reservation = $this->reservation($this->annonce(50000), statut: 'en_attente');

        $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/reservations')
            ->assertOk()
            ->assertJsonPath('demandes.0.id', $reservation->id)
            ->assertJsonPath('demandes.0.montant_total', 57000);

        $this->actingAs($this->admin, 'sanctum')
            ->patchJson("/api/reservations/{$reservation->id}/statut", ['statut' => 'confirmee'])
            ->assertOk();

        $this->assertSame('confirmee', $reservation->fresh()->statut);
    }

    /* ── Les prix restent tenus par le gérant ─────────────────── */

    public function test_le_proprietaire_ne_change_pas_les_prix_d_une_annonce_des_associes(): void
    {
        $villa = $this->annonce(50000);
        $logement = $villa->logements()->first();
        $tarif = $logement->tarifs()->first();
        $corps = ['type_tarif' => 'nuitee', 'prix' => 50000, 'avec_clim' => true, 'avec_buffet' => false];

        $this->actingAs($villa->proprietaire, 'sanctum')
            ->putJson("/api/logements/{$logement->id}/tarifs/{$tarif->id}", $corps)
            ->assertForbidden();
        $this->assertSame(57000, (int) $tarif->fresh()->prix);

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/logements/{$logement->id}/tarifs/{$tarif->id}", ['prix' => 58000] + $corps)
            ->assertOk();
    }

    public function test_le_client_ne_lit_pas_notre_part(): void
    {
        $villa = $this->annonce(50000);

        $json = $this->getJson("/api/villas/{$villa->id}")->assertOk()->json();

        $this->assertArrayNotHasKey('majoration', $json);
        $this->assertArrayNotHasKey('circuit', $json);
    }

    /* ── Rattacher les annonces au compte du vrai propriétaire ─── */

    public function test_les_annonces_d_un_compte_d_attente_passent_au_compte_inscrit(): void
    {
        $attente = User::factory()->proprietaire()->create();
        $this->annonce(50000, proprietaire: $attente);
        $this->annonce(80000, proprietaire: $attente);
        $inscrit = User::factory()->client()->create(['email' => 'agence@exemple.sn']);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/utilisateurs/{$attente->id}/annonces", ['email' => ' Agence@Exemple.sn '])
            ->assertOk();

        $this->assertSame(2, Villa::where('user_id', $inscrit->id)->count());
        $this->assertSame('proprietaire', $inscrit->fresh()->role);
        $this->assertDatabaseHas('journal_admin', ['action' => 'villas.transferees']);
    }

    public function test_le_rattachement_refuse_une_adresse_inconnue_ou_un_admin(): void
    {
        $attente = User::factory()->proprietaire()->create();
        $this->annonce(50000, proprietaire: $attente);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/utilisateurs/{$attente->id}/annonces", ['email' => 'personne@exemple.sn'])
            ->assertNotFound();
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/utilisateurs/{$attente->id}/annonces", ['email' => $this->admin->email])
            ->assertStatus(422);
        $this->assertSame(1, Villa::where('user_id', $attente->id)->count());
    }

    /* ── Clé d'Or ───────────────────────────────────────────── */

    public function test_la_migration_fait_passer_cle_d_or_dans_le_circuit_des_associes(): void
    {
        $compte = User::factory()->proprietaire()->create(['email' => ImportCleDor::EMAIL]);
        $villa = $this->annonce(200000, associes: false, proprietaire: $compte);
        $ailleurs = $this->annonce(200000, associes: false);

        $migration = require database_path('migrations/2026_10_29_000002_majore_les_prix_de_cle_dor.php');
        $migration->up();
        $migration->up();

        $this->assertSame(228000, (int) $villa->logements()->first()->tarifs()->first()->prix);
        $this->assertSame('associe', $villa->fresh()->circuit);
        $this->assertSame(200000, (int) $ailleurs->logements()->first()->tarifs()->first()->prix);
        $this->assertSame('direct', $ailleurs->fresh()->circuit);
    }
}
