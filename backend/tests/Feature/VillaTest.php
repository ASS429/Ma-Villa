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

    public function test_public_cannot_show_a_villa_pending_moderation(): void
    {
        $enAttente = Villa::factory()->create(['statut' => 'en_attente']);
        $rejetee   = Villa::factory()->rejetee()->create();

        $this->getJson("/api/villas/{$enAttente->id}")->assertNotFound();
        $this->getJson("/api/villas/{$rejetee->id}")->assertNotFound();
    }

    public function test_owner_can_preview_own_villa_pending_moderation(): void
    {
        $villa = Villa::factory()->create(['statut' => 'en_attente']);

        $this->actingAs($villa->proprietaire, 'sanctum')
             ->getJson("/api/villas/{$villa->id}")
             ->assertOk()
             ->assertJsonFragment(['id' => $villa->id]);
    }

    public function test_admin_can_preview_a_villa_pending_moderation(): void
    {
        $villa = Villa::factory()->create(['statut' => 'en_attente']);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
             ->getJson("/api/villas/{$villa->id}")
             ->assertOk();
    }

    public function test_other_user_cannot_preview_a_villa_pending_moderation(): void
    {
        $villa = Villa::factory()->create(['statut' => 'en_attente']);
        $autre = User::factory()->proprietaire()->create();

        $this->actingAs($autre, 'sanctum')
             ->getJson("/api/villas/{$villa->id}")
             ->assertNotFound();
    }

    // ── Agrégats affichés sur la carte de villa ──────────────────

    public function test_public_listing_exposes_price_rating_and_capacity(): void
    {
        $villa = Villa::factory()->validee()->create();
        $logement = $villa->logements()->create([
            'type' => 'chambre', 'nom' => 'Chambre 1', 'capacite' => 4, 'disponible' => true,
        ]);
        $logement->tarifs()->createMany([
            ['type_tarif' => 'nuitee', 'prix' => 45000],
            ['type_tarif' => 'journee', 'prix' => 25000],
        ]);
        $villa->avis()->createMany([
            ['user_id' => User::factory()->create()->id, 'note' => 4],
            ['user_id' => User::factory()->create()->id, 'note' => 5],
        ]);

        $data = $this->getJson('/api/villas')->assertOk()->json('data.0');

        $this->assertEquals(25000, $data['prix_min']);
        $this->assertEquals(4.5, (float) $data['note_moyenne']);
        $this->assertEquals(2, $data['avis_count']);
        $this->assertEquals(4, $data['capacite_max']);
    }

    public function test_public_listing_filters_by_availability_dates(): void
    {
        $libre    = Villa::factory()->validee()->create(['nom' => 'Villa libre']);
        $occupee  = Villa::factory()->validee()->create(['nom' => 'Villa occupee']);

        foreach ([$libre, $occupee] as $villa) {
            $logement = $villa->logements()->create([
                'type' => 'villa_entiere', 'nom' => 'Ensemble', 'capacite' => 6, 'disponible' => true,
            ]);
            $logement->tarifs()->create(['type_tarif' => 'nuitee', 'prix' => 50000]);
        }

        $logementOccupe = $occupee->logements()->first();
        $logementOccupe->reservations()->create([
            'user_id'       => User::factory()->create()->id,
            'tarif_id'      => $logementOccupe->tarifs()->first()->id,
            'date_debut'    => '2026-12-10',
            'date_fin'      => '2026-12-20',
            'nb_personnes'  => 2,
            'montant_total' => 500000,
            'statut'        => 'confirmee',
        ]);

        $data = $this->getJson('/api/villas?date_debut=2026-12-14&date_fin=2026-12-16')
                     ->assertOk()->json('data');

        $this->assertCount(1, $data);
        $this->assertEquals('Villa libre', $data[0]['nom']);
    }

    // ── Filtre par note et tris ──────────────────────────────────
    //
    // Ces cas ne sont pas que fonctionnels : ils exercent le SQL de tri et de
    // filtrage, qui doit rester valide sur PostgreSQL (base de production) et
    // pas seulement sur SQLite. Les alias de SELECT ne sont réutilisables ni
    // dans HAVING ni dans une expression ORDER BY sur Postgres.

    /** Crée une villa validée avec un prix mini et, éventuellement, des notes. */
    private function villaAvec(string $nom, ?int $prix, array $notes = []): Villa
    {
        $villa = Villa::factory()->validee()->create(['nom' => $nom]);

        if ($prix !== null) {
            $logement = $villa->logements()->create([
                'type' => 'chambre', 'nom' => 'Chambre', 'capacite' => 2, 'disponible' => true,
            ]);
            $logement->tarifs()->create(['type_tarif' => 'nuitee', 'prix' => $prix]);
        }

        foreach ($notes as $note) {
            $villa->avis()->create(['user_id' => User::factory()->create()->id, 'note' => $note]);
        }

        return $villa;
    }

    public function test_public_listing_filters_by_minimum_rating(): void
    {
        $this->villaAvec('Bien notee', 30000, [5, 4]);   // moyenne 4.5
        $this->villaAvec('Mal notee', 30000, [2, 3]);    // moyenne 2.5
        $this->villaAvec('Sans avis', 30000);

        $noms = collect($this->getJson('/api/villas?note_min=4')->assertOk()->json('data'))
            ->pluck('nom')->all();

        $this->assertEquals(['Bien notee'], $noms);
    }

    public function test_public_listing_sorts_by_price_ascending(): void
    {
        $this->villaAvec('Chere', 90000);
        $this->villaAvec('Bon marche', 20000);
        $this->villaAvec('Sans tarif', null);

        $noms = collect($this->getJson('/api/villas?tri=prix_asc')->assertOk()->json('data'))
            ->pluck('nom')->all();

        // Les villas sans tarif ferment la marche, quel que soit le moteur.
        $this->assertEquals(['Bon marche', 'Chere', 'Sans tarif'], $noms);
    }

    public function test_public_listing_sorts_by_price_descending(): void
    {
        $this->villaAvec('Chere', 90000);
        $this->villaAvec('Bon marche', 20000);
        $this->villaAvec('Sans tarif', null);

        $noms = collect($this->getJson('/api/villas?tri=prix_desc')->assertOk()->json('data'))
            ->pluck('nom')->all();

        $this->assertEquals(['Chere', 'Bon marche', 'Sans tarif'], $noms);
    }

    public function test_public_listing_sorts_by_rating(): void
    {
        $this->villaAvec('Moyenne', 30000, [3]);
        $this->villaAvec('Excellente', 30000, [5, 5]);
        $this->villaAvec('Sans avis', 30000);

        $noms = collect($this->getJson('/api/villas?tri=note')->assertOk()->json('data'))
            ->pluck('nom')->all();

        $this->assertEquals(['Excellente', 'Moyenne', 'Sans avis'], $noms);
    }

    public function test_public_listing_rejects_invalid_sort(): void
    {
        $this->getJson('/api/villas?tri=; drop table villas')->assertStatus(422);
    }

    public function test_cancelled_reservation_frees_the_dates(): void
    {
        $villa = Villa::factory()->validee()->create();
        $logement = $villa->logements()->create([
            'type' => 'villa_entiere', 'nom' => 'Ensemble', 'capacite' => 6, 'disponible' => true,
        ]);
        $tarif = $logement->tarifs()->create(['type_tarif' => 'nuitee', 'prix' => 50000]);
        $logement->reservations()->create([
            'user_id'       => User::factory()->create()->id,
            'tarif_id'      => $tarif->id,
            'date_debut'    => '2026-12-10',
            'date_fin'      => '2026-12-20',
            'nb_personnes'  => 2,
            'montant_total' => 500000,
            'statut'        => 'annulee',
        ]);

        $this->assertCount(
            1,
            $this->getJson('/api/villas?date_debut=2026-12-14&date_fin=2026-12-16')->json('data')
        );
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
