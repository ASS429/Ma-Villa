<?php

namespace Tests\Feature;

use App\Models\Favori;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FavoriTest extends TestCase
{
    use RefreshDatabase;

    // ── Add ─────────────────────────────────────────────────────

    public function test_client_can_add_favori(): void
    {
        $client = User::factory()->client()->create();
        $villa  = Villa::factory()->validee()->create();

        $response = $this->actingAs($client, 'sanctum')
             ->postJson("/api/villas/{$villa->id}/favoris");

        $response->assertStatus(201);
        $this->assertDatabaseHas('favoris', ['user_id' => $client->id, 'villa_id' => $villa->id]);
    }

    public function test_adding_favori_twice_is_idempotent(): void
    {
        $client = User::factory()->client()->create();
        $villa  = Villa::factory()->validee()->create();

        $this->actingAs($client, 'sanctum')->postJson("/api/villas/{$villa->id}/favoris");
        $this->actingAs($client, 'sanctum')->postJson("/api/villas/{$villa->id}/favoris")->assertStatus(201);

        $this->assertDatabaseCount('favoris', 1);
    }

    // ── Remove ───────────────────────────────────────────────────

    public function test_client_can_remove_favori(): void
    {
        $client = User::factory()->client()->create();
        $villa  = Villa::factory()->validee()->create();

        Favori::create(['user_id' => $client->id, 'villa_id' => $villa->id]);

        $this->actingAs($client, 'sanctum')
             ->deleteJson("/api/villas/{$villa->id}/favoris")
             ->assertOk();

        $this->assertDatabaseMissing('favoris', ['user_id' => $client->id, 'villa_id' => $villa->id]);
    }

    public function test_removing_non_existent_favori_returns_ok(): void
    {
        $client = User::factory()->client()->create();
        $villa  = Villa::factory()->validee()->create();

        $this->actingAs($client, 'sanctum')
             ->deleteJson("/api/villas/{$villa->id}/favoris")
             ->assertOk();
    }

    // ── List ─────────────────────────────────────────────────────

    public function test_client_can_list_own_favoris(): void
    {
        $client = User::factory()->client()->create();
        $other  = User::factory()->client()->create();
        $villa1 = Villa::factory()->validee()->create();
        $villa2 = Villa::factory()->validee()->create();
        $villa3 = Villa::factory()->validee()->create();

        Favori::create(['user_id' => $client->id, 'villa_id' => $villa1->id]);
        Favori::create(['user_id' => $client->id, 'villa_id' => $villa2->id]);
        Favori::create(['user_id' => $other->id,  'villa_id' => $villa3->id]);

        $response = $this->actingAs($client, 'sanctum')->getJson('/api/favoris');

        $response->assertOk();
        $this->assertCount(2, $response->json());
    }

    public function test_favoris_list_is_empty_when_none_added(): void
    {
        $client = User::factory()->client()->create();

        $response = $this->actingAs($client, 'sanctum')->getJson('/api/favoris');

        $response->assertOk();
        $this->assertCount(0, $response->json());
    }

    // ── Auth guard ───────────────────────────────────────────────

    public function test_unauthenticated_cannot_list_favoris(): void
    {
        $this->getJson('/api/favoris')->assertStatus(401);
    }

    public function test_unauthenticated_cannot_add_favori(): void
    {
        $villa = Villa::factory()->validee()->create();

        $this->postJson("/api/villas/{$villa->id}/favoris")->assertStatus(401);
    }

    public function test_unauthenticated_cannot_remove_favori(): void
    {
        $villa = Villa::factory()->validee()->create();

        $this->deleteJson("/api/villas/{$villa->id}/favoris")->assertStatus(401);
    }
}
