<?php

namespace Tests\Feature;

use App\Models\Avis;
use App\Models\Logement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    private function makeSetup(): array
    {
        $proprietaire = User::factory()->proprietaire()->create();
        $villa = Villa::factory()->validee()->create(['user_id' => $proprietaire->id]);
        $logement = Logement::create([
            'villa_id'   => $villa->id,
            'nom'        => 'Suite',
            'type'       => 'villa_entiere',
            'capacite'   => 4,
            'disponible' => true,
        ]);
        $tarif = Tarif::create([
            'logement_id' => $logement->id,
            'type_tarif'  => 'nuitee',
            'prix'        => 100000,
            'avec_clim'   => false,
            'avec_buffet' => false,
        ]);

        return compact('proprietaire', 'villa', 'logement', 'tarif');
    }

    // ── Stats ────────────────────────────────────────────────────

    public function test_admin_can_get_stats(): void
    {
        $admin        = User::factory()->admin()->create();
        $proprietaire = User::factory()->proprietaire()->create();
        User::factory()->client()->count(3)->create();
        Villa::factory()->validee()->count(2)->create(['user_id' => $proprietaire->id]);
        Villa::factory()->create(['statut' => 'en_attente', 'user_id' => $proprietaire->id]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/stats');

        $response->assertOk()
                 ->assertJsonStructure(['utilisateurs', 'villas_total', 'villas_attente', 'reservations', 'revenus']);

        $this->assertEquals(5, $response->json('utilisateurs')); // admin + proprietaire + 3 clients
        $this->assertEquals(3, $response->json('villas_total'));
        $this->assertEquals(1, $response->json('villas_attente'));
    }

    public function test_stats_revenus_counts_only_confirmed_reservations(): void
    {
        $admin  = User::factory()->admin()->create();
        $client = User::factory()->client()->create();
        $setup  = $this->makeSetup();

        Reservation::create([
            'user_id'      => $client->id,
            'logement_id'  => $setup['logement']->id,
            'tarif_id'     => $setup['tarif']->id,
            'date_debut'   => now()->addDays(1)->toDateString(),
            'date_fin'     => now()->addDays(3)->toDateString(),
            'nb_personnes' => 2,
            'montant_total'=> 200000,
            'statut'       => 'confirmee',
        ]);
        Reservation::create([
            'user_id'      => $client->id,
            'logement_id'  => $setup['logement']->id,
            'tarif_id'     => $setup['tarif']->id,
            'date_debut'   => now()->addDays(10)->toDateString(),
            'date_fin'     => now()->addDays(12)->toDateString(),
            'nb_personnes' => 2,
            'montant_total'=> 100000,
            'statut'       => 'en_attente',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/stats');

        $this->assertEquals(200000, $response->json('revenus'));
    }

    // ── Villa management ─────────────────────────────────────────

    public function test_admin_can_list_villas_by_status(): void
    {
        $admin = User::factory()->admin()->create();
        Villa::factory()->count(3)->create(['statut' => 'en_attente']);
        Villa::factory()->validee()->count(2)->create();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/villas?statut=en_attente');

        $response->assertOk();
        $this->assertCount(3, $response->json());
    }

    public function test_admin_villa_list_defaults_to_en_attente(): void
    {
        $admin = User::factory()->admin()->create();
        Villa::factory()->count(2)->create(['statut' => 'en_attente']);
        Villa::factory()->validee()->count(4)->create();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/villas');

        $response->assertOk();
        $this->assertCount(2, $response->json());
    }

    public function test_admin_can_validate_villa(): void
    {
        $admin = User::factory()->admin()->create();
        $villa = Villa::factory()->create(['statut' => 'en_attente']);

        $this->actingAs($admin, 'sanctum')
             ->patchJson("/api/admin/villas/{$villa->id}/statut", ['statut' => 'validee'])
             ->assertOk();

        $this->assertDatabaseHas('villas', ['id' => $villa->id, 'statut' => 'validee']);
    }

    public function test_admin_can_reject_villa(): void
    {
        $admin = User::factory()->admin()->create();
        $villa = Villa::factory()->create(['statut' => 'en_attente']);

        $this->actingAs($admin, 'sanctum')
             ->patchJson("/api/admin/villas/{$villa->id}/statut", ['statut' => 'rejetee'])
             ->assertOk();

        $this->assertDatabaseHas('villas', ['id' => $villa->id, 'statut' => 'rejetee']);
    }

    public function test_admin_can_toggle_vedette_on(): void
    {
        $admin = User::factory()->admin()->create();
        $villa = Villa::factory()->validee()->create(['vedette' => false]);

        $this->actingAs($admin, 'sanctum')
             ->patchJson("/api/admin/villas/{$villa->id}/vedette")
             ->assertOk();

        $this->assertDatabaseHas('villas', ['id' => $villa->id, 'vedette' => true]);
    }

    public function test_admin_can_toggle_vedette_off(): void
    {
        $admin = User::factory()->admin()->create();
        $villa = Villa::factory()->validee()->create(['vedette' => true]);

        $this->actingAs($admin, 'sanctum')
             ->patchJson("/api/admin/villas/{$villa->id}/vedette")
             ->assertOk();

        $this->assertDatabaseHas('villas', ['id' => $villa->id, 'vedette' => false]);
    }

    // ── User management ──────────────────────────────────────────

    public function test_admin_can_list_users(): void
    {
        $admin = User::factory()->admin()->create();
        User::factory()->client()->count(4)->create();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/utilisateurs');

        $response->assertOk();
        $this->assertCount(5, $response->json()); // 4 clients + admin
    }

    public function test_admin_can_delete_user(): void
    {
        $admin  = User::factory()->admin()->create();
        $client = User::factory()->client()->create();

        $this->actingAs($admin, 'sanctum')
             ->deleteJson("/api/admin/utilisateurs/{$client->id}")
             ->assertOk();

        $this->assertDatabaseMissing('users', ['id' => $client->id]);
    }

    // ── Avis management ──────────────────────────────────────────

    public function test_admin_can_list_avis(): void
    {
        $admin  = User::factory()->admin()->create();
        $client = User::factory()->client()->create();
        $villa  = Villa::factory()->validee()->create();

        Avis::create(['user_id' => $client->id, 'villa_id' => $villa->id, 'note' => 4, 'commentaire' => 'Bien']);
        Avis::create(['user_id' => $client->id, 'villa_id' => $villa->id, 'note' => 5, 'commentaire' => 'Excellent']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/avis');

        $response->assertOk();
        $this->assertCount(2, $response->json());
    }

    public function test_admin_can_delete_avis(): void
    {
        $admin  = User::factory()->admin()->create();
        $client = User::factory()->client()->create();
        $villa  = Villa::factory()->validee()->create();
        $avis   = Avis::create(['user_id' => $client->id, 'villa_id' => $villa->id, 'note' => 3, 'commentaire' => 'Moyen']);

        $this->actingAs($admin, 'sanctum')
             ->deleteJson("/api/admin/avis/{$avis->id}")
             ->assertOk();

        $this->assertDatabaseMissing('avis', ['id' => $avis->id]);
    }

    // ── Access control ───────────────────────────────────────────

    public function test_client_cannot_access_admin_stats(): void
    {
        $client = User::factory()->client()->create();

        $this->actingAs($client, 'sanctum')->getJson('/api/admin/stats')->assertStatus(403);
    }

    public function test_client_cannot_access_admin_villas(): void
    {
        $client = User::factory()->client()->create();

        $this->actingAs($client, 'sanctum')->getJson('/api/admin/villas')->assertStatus(403);
    }

    public function test_client_cannot_access_admin_utilisateurs(): void
    {
        $client = User::factory()->client()->create();

        $this->actingAs($client, 'sanctum')->getJson('/api/admin/utilisateurs')->assertStatus(403);
    }

    public function test_proprietaire_cannot_access_admin_routes(): void
    {
        $proprietaire = User::factory()->proprietaire()->create();

        $this->actingAs($proprietaire, 'sanctum')->getJson('/api/admin/stats')->assertStatus(403);
    }

    public function test_unauthenticated_cannot_access_admin_routes(): void
    {
        $this->getJson('/api/admin/stats')->assertStatus(401);
    }
}
