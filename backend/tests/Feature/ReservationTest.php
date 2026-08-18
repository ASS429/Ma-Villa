<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationTest extends TestCase
{
    use RefreshDatabase;

    private function makeSetup(): array
    {
        $proprietaire = User::factory()->proprietaire()->create();
        $villa = Villa::factory()->validee()->create(['user_id' => $proprietaire->id]);
        $logement = Logement::create([
            'villa_id'   => $villa->id,
            'nom'        => 'Suite Principale',
            'type'       => 'villa_entiere',
            'capacite'   => 6,
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

    // ── Create reservation ───────────────────────────────────────

    public function test_client_can_create_reservation(): void
    {
        ['logement' => $logement, 'tarif' => $tarif] = $this->makeSetup();
        $client = User::factory()->client()->create();

        $response = $this->actingAs($client, 'sanctum')
             ->postJson('/api/reservations', [
                 'logement_id'  => $logement->id,
                 'tarif_id'     => $tarif->id,
                 'date_debut'   => now()->addDays(5)->toDateString(),
                 'date_fin'     => now()->addDays(8)->toDateString(),
                 'nb_personnes' => 2,
             ]);

        $response->assertStatus(201);
        // montant = 100000 * 3 nuits = 300000
        $this->assertEquals(300000, $response->json('montant_total'));
        $this->assertDatabaseHas('reservations', ['user_id' => $client->id, 'statut' => 'en_attente']);
    }

    public function test_reservation_for_one_day_calculates_correctly(): void
    {
        ['logement' => $logement, 'tarif' => $tarif] = $this->makeSetup();
        $client = User::factory()->client()->create();

        $date = now()->addDays(5)->toDateString();
        $response = $this->actingAs($client, 'sanctum')
             ->postJson('/api/reservations', [
                 'logement_id'  => $logement->id,
                 'tarif_id'     => $tarif->id,
                 'date_debut'   => $date,
                 'date_fin'     => $date,
                 'nb_personnes' => 1,
             ]);

        $response->assertStatus(201);
        $this->assertEquals(100000, $response->json('montant_total'));
    }

    public function test_proprietaire_cannot_create_reservation(): void
    {
        ['logement' => $logement, 'tarif' => $tarif, 'proprietaire' => $proprietaire] = $this->makeSetup();

        $this->actingAs($proprietaire, 'sanctum')
             ->postJson('/api/reservations', [
                 'logement_id'  => $logement->id,
                 'tarif_id'     => $tarif->id,
                 'date_debut'   => now()->addDays(5)->toDateString(),
                 'date_fin'     => now()->addDays(8)->toDateString(),
                 'nb_personnes' => 2,
             ])->assertStatus(403);
    }

    public function test_admin_cannot_create_reservation(): void
    {
        ['logement' => $logement, 'tarif' => $tarif] = $this->makeSetup();
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/reservations', [
                 'logement_id'  => $logement->id,
                 'tarif_id'     => $tarif->id,
                 'date_debut'   => now()->addDays(5)->toDateString(),
                 'date_fin'     => now()->addDays(8)->toDateString(),
                 'nb_personnes' => 1,
             ])->assertStatus(403);
    }

    public function test_conflicting_reservation_is_rejected(): void
    {
        ['logement' => $logement, 'tarif' => $tarif, 'proprietaire' => $proprietaire] = $this->makeSetup();
        $client1 = User::factory()->client()->create();
        $client2 = User::factory()->client()->create();

        // Première réservation
        Reservation::create([
            'user_id'      => $client1->id,
            'logement_id'  => $logement->id,
            'tarif_id'     => $tarif->id,
            'date_debut'   => now()->addDays(5)->toDateString(),
            'date_fin'     => now()->addDays(10)->toDateString(),
            'nb_personnes' => 2,
            'montant_total'=> 500000,
            'statut'       => 'confirmee',
        ]);

        // Deuxième réservation chevauchante
        $this->actingAs($client2, 'sanctum')
             ->postJson('/api/reservations', [
                 'logement_id'  => $logement->id,
                 'tarif_id'     => $tarif->id,
                 'date_debut'   => now()->addDays(7)->toDateString(),
                 'date_fin'     => now()->addDays(12)->toDateString(),
                 'nb_personnes' => 2,
             ])->assertStatus(409);
    }

    public function test_unauthenticated_cannot_create_reservation(): void
    {
        $this->postJson('/api/reservations', [])->assertStatus(401);
    }

    /**
     * Le tarif appliqué doit appartenir au logement réservé.
     *
     * Sans cette contrainte, le client choisit son prix : il envoie
     * l'identifiant du tarif le moins cher de la plateforme et réserve la
     * villa la plus chère à ce tarif-là. Le paiement porte sur ce montant,
     * réussit, et confirme la réservation.
     */
    public function test_reservation_rejects_a_tarif_from_another_logement(): void
    {
        ['logement' => $logement] = $this->makeSetup();
        $client = User::factory()->client()->create();

        // Un logement bon marché ailleurs sur la plateforme.
        $autreProprio = User::factory()->proprietaire()->create();
        $autreVilla = Villa::factory()->validee()->create(['user_id' => $autreProprio->id]);
        $autreLogement = Logement::create([
            'villa_id' => $autreVilla->id, 'nom' => 'Studio', 'type' => 'chambre',
            'capacite' => 2, 'disponible' => true,
        ]);
        $tarifBradé = Tarif::create([
            'logement_id' => $autreLogement->id, 'type_tarif' => 'nuitee',
            'prix' => 1000, 'avec_clim' => false, 'avec_buffet' => false,
        ]);

        $this->actingAs($client, 'sanctum')
             ->postJson('/api/reservations', [
                 'logement_id'  => $logement->id,
                 'tarif_id'     => $tarifBradé->id,
                 'date_debut'   => now()->addDays(5)->toDateString(),
                 'date_fin'     => now()->addDays(8)->toDateString(),
                 'nb_personnes' => 2,
             ])->assertStatus(422);

        $this->assertDatabaseCount('reservations', 0);
    }

    // ── Listing ──────────────────────────────────────────────────

    public function test_client_sees_only_own_reservations(): void
    {
        ['logement' => $logement, 'tarif' => $tarif] = $this->makeSetup();
        $client1 = User::factory()->client()->create();
        $client2 = User::factory()->client()->create();

        Reservation::create(['user_id' => $client1->id, 'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
            'date_debut' => now()->addDays(1)->toDateString(), 'date_fin' => now()->addDays(3)->toDateString(),
            'nb_personnes' => 1, 'montant_total' => 200000, 'statut' => 'en_attente']);
        Reservation::create(['user_id' => $client2->id, 'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
            'date_debut' => now()->addDays(5)->toDateString(), 'date_fin' => now()->addDays(7)->toDateString(),
            'nb_personnes' => 1, 'montant_total' => 200000, 'statut' => 'en_attente']);

        $response = $this->actingAs($client1, 'sanctum')->getJson('/api/reservations');

        $response->assertOk();
        $this->assertCount(1, $response->json());
    }

    public function test_proprietaire_sees_reservations_for_his_villa(): void
    {
        ['logement' => $logement, 'tarif' => $tarif, 'proprietaire' => $proprietaire] = $this->makeSetup();
        $client = User::factory()->client()->create();
        $otherProp = User::factory()->proprietaire()->create();
        $otherVilla = Villa::factory()->validee()->create(['user_id' => $otherProp->id]);
        $otherLogement = Logement::create(['villa_id' => $otherVilla->id, 'nom' => 'Other', 'type' => 'chambre', 'capacite' => 2, 'disponible' => true]);
        $otherTarif = Tarif::create(['logement_id' => $otherLogement->id, 'type_tarif' => 'nuitee', 'prix' => 50000, 'avec_clim' => false, 'avec_buffet' => false]);

        // 2 réservations sur la villa du propriétaire
        Reservation::create(['user_id' => $client->id, 'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
            'date_debut' => now()->addDays(1)->toDateString(), 'date_fin' => now()->addDays(2)->toDateString(),
            'nb_personnes' => 1, 'montant_total' => 100000, 'statut' => 'en_attente']);
        Reservation::create(['user_id' => $client->id, 'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
            'date_debut' => now()->addDays(10)->toDateString(), 'date_fin' => now()->addDays(12)->toDateString(),
            'nb_personnes' => 1, 'montant_total' => 200000, 'statut' => 'en_attente']);
        // 1 réservation sur une autre villa
        Reservation::create(['user_id' => $client->id, 'logement_id' => $otherLogement->id, 'tarif_id' => $otherTarif->id,
            'date_debut' => now()->addDays(5)->toDateString(), 'date_fin' => now()->addDays(6)->toDateString(),
            'nb_personnes' => 1, 'montant_total' => 50000, 'statut' => 'en_attente']);

        $response = $this->actingAs($proprietaire, 'sanctum')->getJson('/api/reservations');

        $response->assertOk();
        $this->assertCount(2, $response->json());
    }

    // ── Update status ────────────────────────────────────────────

    private function makeReservation(User $client, array $setup): Reservation
    {
        return Reservation::create([
            'user_id'      => $client->id,
            'logement_id'  => $setup['logement']->id,
            'tarif_id'     => $setup['tarif']->id,
            'date_debut'   => now()->addDays(5)->toDateString(),
            'date_fin'     => now()->addDays(8)->toDateString(),
            'nb_personnes' => 2,
            'montant_total' => 300000,
            'statut'       => 'en_attente',
        ]);
    }

    public function test_proprietaire_can_confirm_reservation(): void
    {
        $setup = $this->makeSetup();
        $client = User::factory()->client()->create();
        $reservation = $this->makeReservation($client, $setup);

        $this->actingAs($setup['proprietaire'], 'sanctum')
             ->patchJson("/api/reservations/{$reservation->id}/statut", ['statut' => 'confirmee'])
             ->assertOk();

        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'statut' => 'confirmee']);
    }

    public function test_proprietaire_can_reject_reservation(): void
    {
        $setup = $this->makeSetup();
        $client = User::factory()->client()->create();
        $reservation = $this->makeReservation($client, $setup);

        $this->actingAs($setup['proprietaire'], 'sanctum')
             ->patchJson("/api/reservations/{$reservation->id}/statut", ['statut' => 'annulee'])
             ->assertOk();

        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'statut' => 'annulee']);
    }

    public function test_client_can_cancel_own_pending_reservation(): void
    {
        $setup = $this->makeSetup();
        $client = User::factory()->client()->create();
        $reservation = $this->makeReservation($client, $setup);

        $this->actingAs($client, 'sanctum')
             ->patchJson("/api/reservations/{$reservation->id}/statut", ['statut' => 'annulee'])
             ->assertOk();

        $this->assertDatabaseHas('reservations', ['id' => $reservation->id, 'statut' => 'annulee']);
    }

    public function test_client_cannot_confirm_own_reservation(): void
    {
        $setup = $this->makeSetup();
        $client = User::factory()->client()->create();
        $reservation = $this->makeReservation($client, $setup);

        $this->actingAs($client, 'sanctum')
             ->patchJson("/api/reservations/{$reservation->id}/statut", ['statut' => 'confirmee'])
             ->assertStatus(403);
    }

    public function test_other_client_cannot_update_reservation(): void
    {
        $setup = $this->makeSetup();
        $client  = User::factory()->client()->create();
        $other   = User::factory()->client()->create();
        $reservation = $this->makeReservation($client, $setup);

        $this->actingAs($other, 'sanctum')
             ->patchJson("/api/reservations/{$reservation->id}/statut", ['statut' => 'annulee'])
             ->assertStatus(403);
    }
}
