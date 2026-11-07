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

    /* ── Le reçu et le devis d'un trajet (7 novembre 2026) ─────────── */

    public function test_le_paiement_etablit_un_recu_dans_la_suite_des_sejours(): void
    {
        // Un reçu de séjour existe déjà cette année : le trajet prend le numéro suivant.
        $annee = (int) now()->format('Y');
        $sejour = new \App\Models\Reglement(['moyen' => 'wave', 'recu_le' => now()->toDateString()]);
        $sejour->forceFill([
            'annee' => $annee, 'rang' => 7, 'numero' => \App\Models\Reglement::numero($annee, 7), 'cle' => str_repeat('a', 40),
            'montant' => 100000, 'client_nom' => 'TEST séjour', 'langue' => 'fr', 'statut' => 'valide', 'createur_nom' => 'Admin',
        ])->save();

        $d = $this->demande();
        $recu = $this->encaisser($d, ['reference' => 'TX-1'])->assertOk()->json('encaissement.recu');

        $this->assertSame(sprintf('RC-%d-0008', $annee), $recu['numero']);
        $this->assertDatabaseHas('reglements', [
            'numero' => $recu['numero'], 'demande_service_id' => $d->id, 'montant' => 35000,
            'devis_numero' => $d->reference, 'client_nom' => 'TEST client', 'statut' => 'valide', 'devis_id' => null,
        ]);

        $pdf = $this->get(parse_url($recu['pdf'], PHP_URL_PATH).'?'.parse_url($recu['pdf'], PHP_URL_QUERY))->assertOk();
        $this->assertSame('application/pdf', $pdf->headers->get('Content-Type'));

        $vue = \App\Http\Controllers\Api\ReglementController::donnees(\App\Models\Reglement::where('numero', $recu['numero'])->first());
        $this->assertSame("D'une ville à l'autre", $vue['prestation']);
        $this->assertStringContainsString($d->reference, $vue['detailService']);
        $this->assertStringContainsString('Thiès', $vue['detailService']);

        // Il entre au registre que lit le comptable.
        $registre = $this->actingAs($this->admin)->get('/api/admin/reglements/export')->assertOk()->getContent();
        $this->assertStringContainsString($recu['numero'], $registre);
    }

    public function test_annuler_le_paiement_annule_le_recu_sans_rendre_son_numero(): void
    {
        $d = $this->demande();
        $numero = $this->encaisser($d)->assertOk()->json('encaissement.recu.numero');

        $this->actingAs($this->admin)->deleteJson("/api/admin/demandes-service/{$d->id}/encaissement")->assertOk();
        $this->assertDatabaseHas('reglements', ['numero' => $numero, 'statut' => 'annule']);

        // Un nouveau paiement a un nouveau numéro.
        $nouveau = $this->encaisser($d)->assertOk()->json('encaissement.recu.numero');
        $this->assertNotSame($numero, $nouveau);
    }

    public function test_le_recu_d_un_trajet_ne_s_annule_pas_depuis_le_registre(): void
    {
        $d = $this->demande();
        $this->encaisser($d)->assertOk();
        $reglement = \App\Models\Reglement::where('demande_service_id', $d->id)->first();

        $this->actingAs($this->admin)->postJson("/api/admin/reglements/{$reglement->id}/annuler", ['motif' => 'Essai depuis le registre'])
            ->assertStatus(409);
        $this->assertSame('valide', $reglement->fresh()->statut);
    }

    public function test_un_devis_etabli_depuis_la_demande_prend_les_conditions_du_transport_et_s_accepte_au_paiement(): void
    {
        $d = $this->demande();

        $devis = $this->actingAs($this->admin)->postJson('/api/admin/devis', [
            'titre' => "D'une ville à l'autre", 'client_nom' => 'TEST client', 'demande_service_id' => $d->id,
            'lignes' => [['designation' => "D'une ville à l'autre", 'detail' => 'Thiès → Dakar', 'quantite' => 1, 'unite' => 'voiture', 'prix_unitaire' => 40000]],
        ])->assertCreated()->json();

        $this->assertStringContainsString('une fois le trajet confirmé', $devis['conditions']);
        $this->assertStringNotContainsString('avant l’arrivée', $devis['conditions']);

        $fiche = $this->actingAs($this->admin)->getJson("/api/admin/demandes-service/{$d->id}")->assertOk();
        $this->assertSame($devis['numero'], $fiche->json('devis_lie.numero'));
        $this->assertSame(40000, $fiche->json('devis_lie.total'));

        $recu = $this->encaisser($d, ['montant' => 40000])->assertOk()->json('encaissement.recu');
        $this->assertDatabaseHas('devis', ['id' => $devis['id'], 'statut' => 'accepte']);
        $this->assertDatabaseHas('reglements', ['numero' => $recu['numero'], 'devis_numero' => $devis['numero'], 'devis_id' => null]);
    }

    public function test_le_devis_d_une_location_sans_chauffeur_dit_ses_propres_conditions(): void
    {
        $d = $this->demande('location_sans_chauffeur');

        $devis = $this->actingAs($this->admin)->postJson('/api/admin/devis', [
            'titre' => 'Location sans chauffeur', 'client_nom' => 'TEST client', 'demande_service_id' => $d->id,
            'lignes' => [['designation' => 'Location sans chauffeur', 'quantite' => 1, 'unite' => 'jour', 'prix_unitaire' => 40000]],
        ])->assertCreated()->json();

        $this->assertStringContainsString('Permis de conduire exigé', $devis['conditions']);
        $this->assertStringNotContainsString('exécute le trajet', $devis['conditions']);
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
