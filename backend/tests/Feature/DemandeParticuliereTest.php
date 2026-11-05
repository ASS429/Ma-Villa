<?php

namespace Tests\Feature;

use App\Models\DemandeParticuliere;
use App\Models\JournalAdmin;
use App\Models\Logement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Les demandes particulières : un anniversaire de trente invités, un séminaire,
 * un long séjour. Ce qui arrivait par e-mail arrive rangé, et ne se perd pas.
 */
class DemandeParticuliereTest extends TestCase
{
    use RefreshDatabase;

    /* ── Le client refusé faute de dates demande à être rappelé ── */

    private function demandeDeRappel(array $en_plus = []): array
    {
        $villa = Villa::factory()->validee()->create(['nom' => 'Résidence Kabrousse']);
        $logement = Logement::create(['villa_id' => $villa->id, 'nom' => 'Chambre bleue', 'type' => 'chambre', 'capacite' => 2, 'disponible' => true]);

        return $en_plus + [
            'logement_id'  => $logement->id,
            'date_debut'   => now()->addDays(10)->toDateString(),
            'date_fin'     => now()->addDays(12)->toDateString(),
            'nb_personnes' => 2,
            'nom'          => 'Awa Ndiaye',
            'telephone'    => '77 123 45 67',
            'email'        => 'awa@exemple.sn',
            'langue'       => 'en',
            'consentement' => true,
        ];
    }

    public function test_le_rappel_garde_les_coordonnees_de_celui_qui_le_demande(): void
    {
        $reponse = $this->postJson('/api/demandes-particulieres/rappel', $this->demandeDeRappel())->assertCreated();

        $d = DemandeParticuliere::firstOrFail();
        $this->assertSame($d->reference, $reponse->json('reference'));
        $this->assertSame('rappel_dates', $d->type);
        $this->assertSame('Dates prises, à rappeler', $d->libelle_type);
        $this->assertSame('Awa Ndiaye', $d->nom);
        $this->assertSame('77 123 45 67', $d->telephone);
        $this->assertSame('nouvelle', $d->statut);
        $this->assertSame(2, $d->personnes_sejour);
        $this->assertStringContainsString('Chambre bleue', $d->message);
    }

    public function test_sans_consentement_rien_n_est_garde(): void
    {
        $sans = $this->demandeDeRappel();
        unset($sans['consentement']);
        $this->postJson('/api/demandes-particulieres/rappel', $sans)->assertStatus(422)->assertJsonValidationErrors('consentement');
        $this->postJson('/api/demandes-particulieres/rappel', ['consentement' => false] + $this->demandeDeRappel())
            ->assertStatus(422)->assertJsonValidationErrors('consentement');

        $this->assertSame(0, DemandeParticuliere::count());
    }

    public function test_un_rappel_exige_un_numero_joignable_et_ecarte_les_robots(): void
    {
        $this->postJson('/api/demandes-particulieres/rappel', $this->demandeDeRappel(['telephone' => '77 12']))
            ->assertStatus(422)->assertJsonValidationErrors('telephone');
        $this->postJson('/api/demandes-particulieres/rappel', $this->demandeDeRappel(['site_web' => 'http://spam']))->assertCreated();

        $this->assertSame(0, DemandeParticuliere::count());
    }

    public function test_le_refus_du_devis_dit_que_les_dates_sont_prises(): void
    {
        $d = $this->demandeDeRappel();
        $tarif = Tarif::create(['logement_id' => $d['logement_id'], 'type_tarif' => 'nuitee', 'prix' => 25000, 'avec_clim' => false, 'avec_buffet' => false]);
        Reservation::create([
            'user_id' => User::factory()->create()->id, 'logement_id' => $d['logement_id'], 'tarif_id' => $tarif->id,
            'date_debut' => $d['date_debut'], 'date_fin' => $d['date_fin'], 'nb_personnes' => 1, 'montant_total' => 50000, 'statut' => 'confirmee',
        ]);

        $this->postJson('/api/devis', [
            'logement_id' => $d['logement_id'], 'tarif_id' => $tarif->id, 'date_debut' => $d['date_debut'], 'date_fin' => $d['date_fin'],
            'nb_personnes' => 1, 'client_nom' => 'Awa', 'telephone' => '77 123 45 67',
        ])->assertStatus(409)->assertJsonPath('motif', 'dates_prises');

        $this->assertSame(0, DemandeParticuliere::count(), 'Le refus seul ne garde rien.');
    }

    /* ── Supprimer ─────────────────────────────────────────────── */

    public function test_supprimer_une_demande_l_efface_et_garde_la_trace_sans_le_nom(): void
    {
        $this->postJson('/api/demandes-particulieres/rappel', $this->demandeDeRappel())->assertCreated();
        $d = DemandeParticuliere::firstOrFail();

        $this->deleteJson("/api/admin/demandes-particulieres/{$d->id}")->assertUnauthorized();
        $this->actingAs(User::factory()->create(['role' => 'client']));
        $this->deleteJson("/api/admin/demandes-particulieres/{$d->id}")->assertForbidden();
        $this->assertSame(1, DemandeParticuliere::count());

        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $this->deleteJson("/api/admin/demandes-particulieres/{$d->id}")->assertOk();

        $this->assertSame(0, DemandeParticuliere::count());
        $trace = JournalAdmin::where('action', 'demande_particuliere.supprimee')->firstOrFail();
        $this->assertStringContainsString($d->reference, $trace->cible_libelle);
        $this->assertStringNotContainsString('Awa', json_encode($trace->getAttributes(), JSON_UNESCAPED_UNICODE));
    }

    private function demande(Villa $villa, array $en_plus = []): array
    {
        return $en_plus + [
            'villa_id'          => $villa->id,
            'type'              => 'evenement',
            'date_debut'        => now()->addDays(20)->toDateString(),
            'date_fin'          => now()->addDays(22)->toDateString(),
            'dates_a_confirmer' => true,
            'personnes_sejour'  => 2,
            'invites'           => 30,
            'besoins'           => ['traiteur', 'decoration', 'traiteur'],
            'message'           => 'Anniversaire avec 25 à 30 invités en journée. Frais en plus ?',
            'nom'               => 'Fiona',
            'email'             => 'fiona@example.com',
        ];
    }

    public function test_une_demande_s_enregistre_rangee_et_nouvelle(): void
    {
        $villa = Villa::factory()->validee()->create(['nom' => 'Villa blanche']);

        $reponse = $this->postJson('/api/demandes-particulieres', $this->demande($villa, ['statut' => 'traitee']))
            ->assertCreated();

        $d = DemandeParticuliere::firstOrFail();
        $this->assertSame('P-'.str_pad((string) $d->id, 4, '0', STR_PAD_LEFT), $reponse->json('reference'));
        $this->assertSame('nouvelle', $d->statut, 'Un visiteur ne crée pas une demande déjà traitée.');
        $this->assertSame(['traiteur', 'decoration'], $d->besoins);
        $this->assertSame(30, $d->invites);
        $this->assertTrue($d->dates_a_confirmer);
    }

    public function test_sans_numero_ni_adresse_personne_ne_peut_repondre(): void
    {
        $villa = Villa::factory()->validee()->create();

        $this->postJson('/api/demandes-particulieres', $this->demande($villa, ['email' => null]))
            ->assertStatus(422)->assertJsonValidationErrors(['telephone', 'email']);

        // Un numéro seul suffit, même collé depuis WhatsApp.
        $this->postJson('/api/demandes-particulieres', $this->demande($villa, [
            'email' => null, 'telephone' => "\u{202A}+221 77 123 45 67\u{202C}",
        ]))->assertCreated();
        $this->assertSame('+221 77 123 45 67', DemandeParticuliere::firstOrFail()->telephone);
    }

    public function test_un_besoin_ou_un_type_inconnu_est_refuse(): void
    {
        $villa = Villa::factory()->validee()->create();

        $this->postJson('/api/demandes-particulieres', $this->demande($villa, ['type' => 'rave']))
            ->assertStatus(422)->assertJsonValidationErrors('type');
        $this->postJson('/api/demandes-particulieres', $this->demande($villa, ['besoins' => ['feu-d-artifice']]))
            ->assertStatus(422)->assertJsonValidationErrors('besoins.0');
    }

    public function test_une_annonce_retiree_ne_recoit_pas_de_demande(): void
    {
        $villa = Villa::factory()->create(['statut' => 'rejetee']);

        $this->postJson('/api/demandes-particulieres', $this->demande($villa))->assertStatus(409);
        $this->assertSame(0, DemandeParticuliere::count());
    }

    public function test_le_champ_piege_ne_cree_rien(): void
    {
        $villa = Villa::factory()->validee()->create();

        $this->postJson('/api/demandes-particulieres', $this->demande($villa, ['site_web' => 'x']))->assertCreated();
        $this->assertSame(0, DemandeParticuliere::count());
    }

    public function test_la_console_la_voit_la_traite_et_la_sort_de_ce_qui_attend(): void
    {
        $admin = User::factory()->admin()->create();
        $villa = Villa::factory()->validee()->create();
        $id = $this->postJson('/api/demandes-particulieres', $this->demande($villa))->json('id');

        $cles = fn () => collect($this->actingAs($admin, 'sanctum')->getJson('/api/admin/attentes')->json('lignes'))->pluck('cle');
        $this->assertContains('demandes_particulieres', $cles());

        $this->actingAs($admin, 'sanctum')->getJson('/api/admin/demandes-particulieres')
            ->assertOk()->assertJsonPath('data.0.villa.id', $villa->id);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/demandes-particulieres/{$id}", ['statut' => 'traitee'])
            ->assertOk()->assertJsonPath('statut', 'traitee');
        $this->assertNotContains('demandes_particulieres', $cles());
        $this->assertDatabaseHas('journal_admin', ['action' => 'demande_particuliere.statut']);
    }

    public function test_seul_l_admin_les_lit(): void
    {
        $client = User::factory()->create();

        $this->actingAs($client, 'sanctum')->getJson('/api/admin/demandes-particulieres')->assertForbidden();
    }
}
