<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Ce que l'audit de sécurité d'octobre 2026 a trouvé autour de la
 * réservation : une annulation qui se rouvrait, des coordonnées données avant
 * l'engagement, et des annonces non publiées lisibles et réservables par
 * d'autres chemins que leur fiche.
 */
class ReglesDeReservationTest extends TestCase
{
    use RefreshDatabase;

    private User $proprietaire;
    private User $client;

    protected function setUp(): void
    {
        parent::setUp();

        $this->proprietaire = User::factory()->proprietaire()->create(['phone' => '+221770000001']);
        $this->client = User::factory()->client()->create(['phone' => '+221770000002']);
    }

    /** @return array{0: Villa, 1: Logement, 2: Tarif} */
    private function annonce(string $statut = 'validee'): array
    {
        $villa = Villa::factory()->validee()->create([
            'user_id'   => $this->proprietaire->id,
            'statut'    => $statut,
            'telephone' => '+221338000000',
        ]);
        $logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'chambre',
            'capacite' => 2, 'disponible' => true,
        ]);
        $tarif = Tarif::create(['logement_id' => $logement->id, 'type_tarif' => 'nuitee', 'prix' => 50000]);

        return [$villa, $logement, $tarif];
    }

    private function demande(Logement $logement, Tarif $tarif)
    {
        return $this->actingAs($this->client, 'sanctum')->postJson('/api/reservations', [
            'logement_id'  => $logement->id,
            'tarif_id'     => $tarif->id,
            'date_debut'   => now()->addDays(10)->toDateString(),
            'date_fin'     => now()->addDays(12)->toDateString(),
            'nb_personnes' => 1,
        ]);
    }

    private function reservation(Logement $logement, Tarif $tarif, string $statut): Reservation
    {
        return Reservation::create([
            'user_id' => $this->client->id, 'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
            'date_debut' => now()->addDays(10)->toDateString(), 'date_fin' => now()->addDays(12)->toDateString(),
            'nb_personnes' => 1, 'montant_total' => 100000, 'statut' => $statut,
        ]);
    }

    /* ── Une annulation est définitive ───────────────────────────── */

    public function test_le_proprietaire_ne_reconfirme_pas_une_reservation_annulee(): void
    {
        [, $logement, $tarif] = $this->annonce();
        $reservation = $this->reservation($logement, $tarif, 'annulee');

        $this->actingAs($this->proprietaire, 'sanctum')
            ->patchJson("/api/reservations/{$reservation->id}/statut", ['statut' => 'confirmee'])
            ->assertStatus(409);

        $this->assertSame('annulee', $reservation->fresh()->statut);
    }

    /* ── Les coordonnées attendent l'engagement ──────────────────── */

    public function test_la_demande_ne_rend_au_client_ni_le_numero_de_la_villa_ni_le_proprietaire(): void
    {
        [, $logement, $tarif] = $this->annonce();

        $reponse = $this->demande($logement, $tarif)->assertCreated();

        $this->assertArrayNotHasKey('telephone', $reponse->json('logement.villa'));
        $this->assertArrayNotHasKey('proprietaire', $reponse->json('logement.villa'));
        $this->assertStringNotContainsString('+221770000001', $reponse->getContent());
        $this->assertStringNotContainsString($this->proprietaire->email, $reponse->getContent());
    }

    public function test_refuser_une_demande_ne_donne_pas_le_numero_du_client(): void
    {
        [, $logement, $tarif] = $this->annonce();
        $reservation = $this->reservation($logement, $tarif, 'en_attente');

        $reponse = $this->actingAs($this->proprietaire, 'sanctum')
            ->patchJson("/api/reservations/{$reservation->id}/statut", ['statut' => 'annulee'])
            ->assertOk();

        $this->assertStringNotContainsString('+221770000002', $reponse->getContent());
    }

    /* ── Une annonce non publiée ne se lit ni ne se réserve ──────── */

    public function test_on_ne_reserve_pas_une_annonce_non_publiee(): void
    {
        [, $logement, $tarif] = $this->annonce('brouillon');

        $this->demande($logement, $tarif)->assertStatus(409);
        $this->assertSame(0, Reservation::count());
    }

    public function test_les_logements_prix_et_calendrier_d_un_brouillon_sont_introuvables(): void
    {
        [$villa, $logement] = $this->annonce('brouillon');

        $this->getJson("/api/villas/{$villa->id}/logements")->assertNotFound();
        $this->getJson("/api/villas/{$villa->id}/logements/{$logement->id}")->assertNotFound();
        $this->getJson("/api/logements/{$logement->id}/tarifs")->assertNotFound();
        $this->getJson("/api/logements/{$logement->id}/disponibilites")->assertNotFound();

        // Le propriétaire, lui, prévisualise son brouillon.
        $this->actingAs($this->proprietaire, 'sanctum')
            ->getJson("/api/villas/{$villa->id}/logements")->assertOk();
    }

    public function test_les_favoris_cachent_le_numero_et_les_annonces_retirees(): void
    {
        [$publiee] = $this->annonce();
        [$brouillon] = $this->annonce('brouillon');

        $this->actingAs($this->client, 'sanctum')->postJson("/api/villas/{$publiee->id}/favoris")->assertCreated();
        $this->actingAs($this->client, 'sanctum')->postJson("/api/villas/{$brouillon->id}/favoris")->assertNotFound();

        $reponse = $this->actingAs($this->client, 'sanctum')->getJson('/api/favoris')->assertOk();

        $this->assertCount(1, $reponse->json());
        $this->assertArrayNotHasKey('telephone', $reponse->json('0.villa'));

        // Une annonce retirée après coup disparaît aussi des favoris.
        $publiee->update(['statut' => 'rejetee']);
        $this->assertCount(0, $this->actingAs($this->client, 'sanctum')->getJson('/api/favoris')->json());
    }
}
