<?php

namespace Tests\Feature;

use App\Models\DemandeService;
use App\Models\User;
use App\Services\Fonds;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PasseTemps encaisse le trajet et reverse sa part au transporteur (décision du
 * 6 novembre 2026). Tant qu'elle n'est pas reversée, cette part n'est pas à nous.
 */
class ArgentDuTransportTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
    }

    private function demande(string $prestation = 'trajet_villes', ?string $date = null): DemandeService
    {
        $d = new DemandeService([
            'prestation' => $prestation, 'date_service' => $date ?? now()->addDays(3)->toDateString(),
            'heure' => '09:30', 'personnes' => 2, 'lieu' => 'Thiès', 'nom' => 'TEST client',
            'telephone' => '+221 76 000 00 01', 'langue' => 'fr', 'origine' => 'transport',
        ]);
        $d->statut = 'nouvelle';
        $d->save();

        return $d;
    }

    private function encaisser(DemandeService $d, array $champs = [])
    {
        return $this->actingAs($this->admin)->postJson("/api/admin/demandes-service/{$d->id}/encaissement", $champs + [
            'montant' => 35000, 'moyen' => 'wave', 'recu_le' => now()->toDateString(),
        ]);
    }

    public function test_par_defaut_la_part_du_transporteur_est_la_somme_moins_notre_commission(): void
    {
        $d = $this->demande();

        $this->encaisser($d)->assertOk()
            ->assertJsonPath('encaissement.montant', 35000)
            ->assertJsonPath('encaissement.part_prestataire', 30000)
            ->assertJsonPath('encaissement.commission', 5000)
            ->assertJsonPath('encaissement.prestataire', 'Mamadou')
            ->assertJsonPath('encaissement.libelle_moyen', 'Wave')
            // Payé, donc confirmé : il sort de la file des réponses à faire.
            ->assertJsonPath('statut', 'traitee');
    }

    public function test_une_autre_ville_plus_chere_garde_la_meme_commission(): void
    {
        $this->encaisser($this->demande(), ['montant' => 50000])->assertOk()
            ->assertJsonPath('encaissement.part_prestataire', 45000)
            ->assertJsonPath('encaissement.commission', 5000);
    }

    public function test_la_part_se_corrige_mais_ne_depasse_pas_la_somme(): void
    {
        $this->encaisser($this->demande(), ['part_prestataire' => 36000])->assertStatus(422)->assertJsonValidationErrors('part_prestataire');
        $this->encaisser($this->demande(), ['part_prestataire' => 31000])->assertOk()->assertJsonPath('encaissement.commission', 4000);
    }

    public function test_un_paiement_ne_s_enregistre_qu_une_fois(): void
    {
        $d = $this->demande();
        $this->encaisser($d)->assertOk();
        $this->encaisser($d)->assertStatus(409);
    }

    public function test_un_service_sans_prestataire_attitre_demande_qui_et_combien(): void
    {
        $d = $this->demande('petit_dejeuner');
        $this->encaisser($d, ['montant' => 10000])->assertStatus(422)->assertJsonValidationErrors('part_prestataire');
        $this->encaisser($d, ['montant' => 10000, 'part_prestataire' => 8000, 'prestataire' => 'Restaurant Chez Fatou'])->assertOk()
            ->assertJsonPath('encaissement.prestataire', 'Restaurant Chez Fatou');
    }

    public function test_la_part_est_gardee_tant_qu_elle_n_est_pas_reversee(): void
    {
        $d = $this->demande();
        $this->encaisser($d)->assertOk();

        $this->assertSame(30000, Fonds::aGarder(true)['transporteurs']);
        $this->assertSame(30000, Fonds::aGarder(true)['total']);
        // Un service se règle à la main : rien de cela n'est sur PayDunya.
        $this->assertSame(0, Fonds::aGarder(false)['transporteurs']);

        $this->actingAs($this->admin)->postJson("/api/admin/demandes-service/{$d->id}/reversement", ['reverse_le' => now()->toDateString(), 'reference' => 'W-123'])
            ->assertOk()->assertJsonPath('encaissement.reverse_le', now()->toDateString());

        $this->assertSame(0, Fonds::aGarder(true)['transporteurs']);
    }

    public function test_ce_qui_attend_rappelle_la_part_une_fois_le_trajet_fait(): void
    {
        $aVenir = $this->demande();
        $this->encaisser($aVenir)->assertOk();
        $lignes = collect($this->actingAs($this->admin)->getJson('/api/admin/attentes')->json('lignes'));
        $this->assertNull($lignes->firstWhere('cle', 'services_a_reverser'), 'Avant le trajet, rien n’est encore dû.');

        $fait = $this->demande('trajet_villes', now()->subDays(3)->toDateString());
        $this->encaisser($fait, ['recu_le' => now()->subDays(4)->toDateString()])->assertOk();
        $ligne = collect($this->actingAs($this->admin)->getJson('/api/admin/attentes')->json('lignes'))->firstWhere('cle', 'services_a_reverser');
        $this->assertSame(30000, $ligne['montant']);
        $this->assertSame('urgent', $ligne['gravite']);
        $this->assertStringContainsString('Mamadou', $ligne['detail']);

        $liste = $this->actingAs($this->admin)->getJson('/api/admin/demandes-service?argent=a_reverser')->assertOk()->json('data');
        $this->assertCount(2, $liste);
    }

    public function test_les_erreurs_se_defont_dans_l_ordre(): void
    {
        $d = $this->demande();
        $url = "/api/admin/demandes-service/{$d->id}";

        $this->actingAs($this->admin)->postJson("{$url}/reversement", ['reverse_le' => now()->toDateString()])->assertStatus(409);
        $this->encaisser($d)->assertOk();
        $this->actingAs($this->admin)->postJson("{$url}/reversement", ['reverse_le' => now()->subDays(1)->toDateString()])
            ->assertStatus(422)->assertJsonValidationErrors('reverse_le');
        $this->actingAs($this->admin)->postJson("{$url}/reversement", ['reverse_le' => now()->toDateString()])->assertOk();

        $this->actingAs($this->admin)->deleteJson("{$url}/encaissement")->assertStatus(409);
        $this->actingAs($this->admin)->deleteJson("{$url}/reversement")->assertOk()->assertJsonPath('encaissement.reverse_le', null);
        $this->actingAs($this->admin)->deleteJson("{$url}/encaissement")->assertOk()->assertJsonPath('encaissement', null);

        $this->assertSame(0, Fonds::aGarder(true)['transporteurs']);
        $this->assertDatabaseHas('journal_admin', ['action' => 'demande_service.encaissement_annule']);
    }

    public function test_seule_l_administration_touche_a_l_argent(): void
    {
        $d = $this->demande();
        $client = User::factory()->create();

        $this->actingAs($client)->postJson("/api/admin/demandes-service/{$d->id}/encaissement", [
            'montant' => 35000, 'moyen' => 'wave', 'recu_le' => now()->toDateString(),
        ])->assertForbidden();
        $this->assertNull($d->fresh()->encaissement);
    }
}
