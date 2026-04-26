<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VillaTest extends TestCase
{
    use RefreshDatabase;

    // ── Public listing ───────────────────────────────────────────

    public function test_public_listing_returns_only_validated_villas(): void
    {
        Villa::factory()->validee()->count(3)->create();
        Villa::factory()->create(['statut' => 'en_attente']);
        Villa::factory()->create(['statut' => 'rejetee']);

        $response = $this->getJson('/api/villas');

        $response->assertOk();
        $data = $response->json('data');
        $this->assertCount(3, $data);
        foreach ($data as $villa) {
            $this->assertEquals('validee', $villa['statut']);
        }
    }

    public function test_public_listing_is_paginated(): void
    {
        Villa::factory()->validee()->count(15)->create();

        $response = $this->getJson('/api/villas');

        $response->assertOk()
                 ->assertJsonStructure(['data', 'current_page', 'last_page', 'total', 'per_page']);
        $this->assertCount(12, $response->json('data'));
        $this->assertEquals(15, $response->json('total'));
        $this->assertEquals(2, $response->json('last_page'));
    }

    public function test_public_listing_filters_by_city(): void
    {
        Villa::factory()->validee()->create(['ville' => 'Dakar']);
        Villa::factory()->validee()->create(['ville' => 'Saly']);
        Villa::factory()->validee()->create(['ville' => 'Mbour']);

        $response = $this->getJson('/api/villas?ville=Saly');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertEquals('Saly', $response->json('data.0.ville'));
    }

    public function test_public_listing_filters_vedette(): void
    {
        Villa::factory()->validee()->create(['vedette' => true]);
        Villa::factory()->validee()->create(['vedette' => false]);
        Villa::factory()->validee()->create(['vedette' => false]);

        $response = $this->getJson('/api/villas?vedette=1');

        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
    }

    public function test_public_can_show_a_validated_villa(): void
    {
        $villa = Villa::factory()->validee()->create();

        $response = $this->getJson("/api/villas/{$villa->id}");

        $response->assertOk()
                 ->assertJsonFragment(['id' => $villa->id, 'nom' => $villa->nom]);
    }

    public function test_public_can_show_any_villa_regardless_of_status(): void
    {
        $pending = Villa::factory()->create(['statut' => 'en_attente']);

        $this->getJson("/api/villas/{$pending->id}")->assertOk();
    }

    // ── Proprietaire CRUD ────────────────────────────────────────

    public function test_proprietaire_can_create_villa(): void
    {
        $proprietaire = User::factory()->proprietaire()->create();

        $response = $this->actingAs($proprietaire, 'sanctum')
             ->postJson('/api/villas', [
                 'nom'         => 'Villa Ngor',
                 'description' => 'Belle villa avec vue mer',
                 'adresse'     => '42 Route de Ngor',
                 'ville'       => 'Dakar',
                 'telephone'   => '+221 77 000 00 00',
             ]);

        $response->assertStatus(201)->assertJsonFragment(['nom' => 'Villa Ngor', 'statut' => 'en_attente']);
        $this->assertDatabaseHas('villas', ['nom' => 'Villa Ngor', 'user_id' => $proprietaire->id]);
    }

    public function test_client_cannot_create_villa(): void
    {
        $client = User::factory()->client()->create();

        $this->actingAs($client, 'sanctum')
             ->postJson('/api/villas', [
                 'nom'       => 'Villa Test',
                 'adresse'   => 'Rue Test',
                 'ville'     => 'Dakar',
                 'telephone' => '+221 77 000 00 00',
             ])->assertStatus(403);
    }

    public function test_unauthenticated_cannot_create_villa(): void
    {
        $this->postJson('/api/villas', ['nom' => 'Test'])->assertStatus(401);
    }

    public function test_proprietaire_can_update_own_villa(): void
    {
        $proprietaire = User::factory()->proprietaire()->create();
        $villa = Villa::factory()->create(['user_id' => $proprietaire->id]);

        $response = $this->actingAs($proprietaire, 'sanctum')
             ->putJson("/api/villas/{$villa->id}", [
                 'nom'         => 'Nouveau nom',
                 'description' => 'Nouvelle description',
                 'adresse'     => $villa->adresse,
                 'ville'       => $villa->ville,
                 'telephone'   => $villa->telephone,
             ]);

        $response->assertOk()->assertJsonFragment(['nom' => 'Nouveau nom']);
    }

    public function test_proprietaire_cannot_update_another_owners_villa(): void
    {
        $owner = User::factory()->proprietaire()->create();
        $other = User::factory()->proprietaire()->create();
        $villa = Villa::factory()->create(['user_id' => $owner->id]);

        $this->actingAs($other, 'sanctum')
             ->putJson("/api/villas/{$villa->id}", [
                 'nom'       => 'Hack',
                 'adresse'   => $villa->adresse,
                 'ville'     => $villa->ville,
                 'telephone' => $villa->telephone,
             ])->assertStatus(403);
    }

    public function test_proprietaire_can_delete_own_villa(): void
    {
        $proprietaire = User::factory()->proprietaire()->create();
        $villa = Villa::factory()->create(['user_id' => $proprietaire->id]);

        $this->actingAs($proprietaire, 'sanctum')
             ->deleteJson("/api/villas/{$villa->id}")
             ->assertOk();

        $this->assertDatabaseMissing('villas', ['id' => $villa->id]);
    }

    public function test_proprietaire_sees_only_own_villas(): void
    {
        $owner = User::factory()->proprietaire()->create();
        $other = User::factory()->proprietaire()->create();

        Villa::factory()->count(3)->create(['user_id' => $owner->id]);
        Villa::factory()->count(2)->create(['user_id' => $other->id]);

        $response = $this->actingAs($owner, 'sanctum')
             ->getJson('/api/proprietaire/villas');

        $response->assertOk();
        $this->assertCount(3, $response->json());
    }
}
