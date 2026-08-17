<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Paiement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaiementTest extends TestCase
{
    use RefreshDatabase;

    private const CLE_MAITRE = 'cle-maitresse-de-test';

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'paiement.actif' => true,
            'paiement.paydunya.cle_maitre'   => self::CLE_MAITRE,
            'paiement.paydunya.cle_privee'   => 'privee',
            'paiement.paydunya.cle_publique' => 'publique',
            'paiement.paydunya.token'        => 'jeton',
            'paiement.commission.taux_eleve'  => 0.20,
            'paiement.commission.taux_reduit' => 0.10,
            'paiement.commission.seuil'       => 50000,
        ]);
    }

    private function reservation(int $montant = 200000): Reservation
    {
        $villa = Villa::factory()->validee()->create();
        $logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'villa_entiere',
            'capacite' => 6, 'disponible' => true,
        ]);
        $tarif = Tarif::create([
            'logement_id' => $logement->id, 'type_tarif' => 'nuitee',
            'prix' => $montant, 'avec_clim' => false, 'avec_buffet' => false,
        ]);

        return Reservation::create([
            'user_id' => User::factory()->client()->create()->id,
            'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
            'date_debut' => now()->addDays(5)->toDateString(),
            'date_fin' => now()->addDays(6)->toDateString(),
            'nb_personnes' => 2, 'montant_total' => $montant, 'statut' => 'en_attente',
        ]);
    }

    private function ipn(string $token, string $statut, ?string $hash = null): array
    {
        return ['data' => [
            'hash'    => $hash ?? hash('sha512', self::CLE_MAITRE),
            'status'  => $statut,
            'invoice' => ['token' => $token, 'total_amount' => '200000'],
            'customer' => ['name' => 'Awa Diop', 'phone' => '770000000'],
        ]];
    }

    /* ── Initiation ─────────────────────────────────────────── */

    public function test_le_client_lance_un_paiement_wave(): void
    {
        Http::fake([
            '*checkout-invoice/create' => Http::response([
                'response_code' => '00', 'response_text' => 'https://paydunya/x', 'token' => 'JETON123',
            ]),
            '*softpay/wave-senegal' => Http::response([
                'success' => true, 'url' => 'https://pay.wave.com/c/abc',
            ]),
        ]);

        $reservation = $this->reservation();

        $reponse = $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '+221 77 123 45 67',
            ])->assertOk();

        $this->assertEquals('https://pay.wave.com/c/abc', $reponse->json('url'));
        $this->assertEquals(200000, $reponse->json('montant'));

        // La répartition est figée dès l'initiation.
        $this->assertDatabaseHas('paiements', [
            'reservation_id' => $reservation->id,
            'token_paydunya' => 'JETON123',
            'statut' => 'en_attente',
            'commission' => 40000,
            'montant_proprietaire' => 160000,
        ]);
    }

    public function test_le_numero_est_normalise_avant_envoi(): void
    {
        // PayDunya attend neuf chiffres : « +221 77 123 45 67 » serait refusé.
        Http::fake([
            '*checkout-invoice/create' => Http::response(['response_code' => '00', 'response_text' => 'u', 'token' => 'T']),
            '*softpay/wave-senegal' => Http::response(['success' => true, 'url' => 'https://pay.wave.com/c/a']),
        ]);

        $reservation = $this->reservation();
        $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '+221 77 123 45 67',
            ])->assertOk();

        Http::assertSent(fn ($r) => ! str_contains($r->url(), 'wave-senegal')
            || $r['wave_senegal_phone'] === '771234567');
    }

    public function test_un_tiers_ne_peut_pas_payer_la_reservation_d_un_autre(): void
    {
        $reservation = $this->reservation();

        $this->actingAs(User::factory()->client()->create(), 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ])->assertForbidden();
    }

    public function test_le_paiement_est_refuse_quand_il_n_est_pas_ouvert(): void
    {
        config(['paiement.actif' => false]);
        $reservation = $this->reservation();

        $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ])->assertStatus(503);
    }

    public function test_une_panne_du_prestataire_ne_casse_pas_la_reservation(): void
    {
        Http::fake(['*' => Http::response(['response_code' => '1001', 'response_text' => 'refus'], 200)]);
        $reservation = $this->reservation();

        $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ])->assertStatus(502);

        $this->assertEquals('en_attente', $reservation->fresh()->statut);
    }

    /* ── IPN — le point sensible ────────────────────────────── */

    public function test_une_notification_sans_signature_valide_est_rejetee(): void
    {
        // Sans ce rempart, n'importe qui s'offrirait une réservation en
        // annonçant « paiement réussi » sur une URL publique.
        $reservation = $this->reservation();
        $paiement = Paiement::create([
            'reservation_id' => $reservation->id, 'methode' => 'wave',
            'montant' => 200000, 'token_paydunya' => 'JETON123', 'statut' => 'en_attente',
        ]);

        $this->postJson('/api/paiements/ipn', $this->ipn('JETON123', 'completed', 'hash-bidon'))
             ->assertForbidden();

        $this->assertEquals('en_attente', $paiement->fresh()->statut);
        $this->assertEquals('en_attente', $reservation->fresh()->statut);
    }

    public function test_une_notification_authentique_confirme_la_reservation(): void
    {
        $reservation = $this->reservation();
        Paiement::create([
            'reservation_id' => $reservation->id, 'methode' => 'wave',
            'montant' => 200000, 'token_paydunya' => 'JETON123', 'statut' => 'en_attente',
        ]);

        $this->postJson('/api/paiements/ipn', $this->ipn('JETON123', 'completed'))->assertOk();

        $this->assertEquals('reussi', $reservation->fresh()->paiement->statut);
        $this->assertEquals('confirmee', $reservation->fresh()->statut);
        $this->assertNotNull($reservation->fresh()->paiement->paye_le);
    }

    public function test_une_notification_repetee_ne_confirme_pas_deux_fois(): void
    {
        // PayDunya peut renvoyer la même notification : le traitement doit
        // être idempotent.
        $reservation = $this->reservation();
        Paiement::create([
            'reservation_id' => $reservation->id, 'methode' => 'wave',
            'montant' => 200000, 'token_paydunya' => 'JETON123', 'statut' => 'en_attente',
        ]);

        $this->postJson('/api/paiements/ipn', $this->ipn('JETON123', 'completed'))->assertOk();
        $paye = $reservation->fresh()->paiement->paye_le;

        $this->postJson('/api/paiements/ipn', $this->ipn('JETON123', 'completed'))->assertOk();

        $this->assertEquals($paye, $reservation->fresh()->paiement->paye_le);
        $this->assertDatabaseCount('paiements', 1);
    }

    public function test_un_paiement_echoue_ne_confirme_rien(): void
    {
        $reservation = $this->reservation();
        Paiement::create([
            'reservation_id' => $reservation->id, 'methode' => 'wave',
            'montant' => 200000, 'token_paydunya' => 'JETON123', 'statut' => 'en_attente',
        ]);

        $this->postJson('/api/paiements/ipn', $this->ipn('JETON123', 'failed'))->assertOk();

        $this->assertEquals('echoue', $reservation->fresh()->paiement->statut);
        $this->assertEquals('en_attente', $reservation->fresh()->statut);
        $this->assertNull($reservation->fresh()->paiement->paye_le);
    }

    public function test_une_notification_pour_une_facture_inconnue_est_acquittee(): void
    {
        // 200 volontaire : un 404 ferait réessayer PayDunya indéfiniment.
        $this->postJson('/api/paiements/ipn', $this->ipn('FACTURE-INCONNUE', 'completed'))
             ->assertOk();
    }

    public function test_le_client_suit_l_etat_de_son_paiement(): void
    {
        $reservation = $this->reservation();
        Paiement::create([
            'reservation_id' => $reservation->id, 'methode' => 'orange_money',
            'montant' => 200000, 'reference' => 'MV-ABC', 'statut' => 'en_attente',
        ]);

        $this->actingAs($reservation->client, 'sanctum')
            ->getJson("/api/reservations/{$reservation->id}/paiement")
            ->assertOk()
            ->assertJsonPath('statut', 'en_attente')
            ->assertJsonPath('reference', 'MV-ABC');
    }

    /* ── Reprise du paiement depuis la liste ────────────────── */

    public function test_la_liste_des_reservations_porte_l_etat_du_paiement(): void
    {
        // Sans cette information, le client n'a aucun moyen de savoir ce qui
        // lui reste à régler : le tunnel n'était atteignable que dans les
        // secondes suivant la demande, sur la fiche de la villa.
        $reservation = $this->reservation();
        Paiement::create([
            'reservation_id' => $reservation->id, 'methode' => 'wave',
            'montant' => 200000, 'reference' => 'MV-XYZ', 'statut' => 'en_attente',
        ]);

        $this->actingAs($reservation->client, 'sanctum')
            ->getJson('/api/reservations')
            ->assertOk()
            ->assertJsonPath('0.paiement.statut', 'en_attente')
            ->assertJsonPath('0.paiement.reference', 'MV-XYZ');
    }

    public function test_une_reservation_sans_paiement_le_dit_explicitement(): void
    {
        // `null` plutôt qu'absent : le front distingue « rien à régler encore »
        // d'une clé oubliée dans la réponse.
        $reservation = $this->reservation();

        $this->actingAs($reservation->client, 'sanctum')
            ->getJson('/api/reservations')
            ->assertOk()
            ->assertJsonPath('0.paiement', null);
    }

    public function test_le_jeton_du_prestataire_ne_sort_jamais_de_l_api(): void
    {
        // Qui détient ce jeton peut agir sur la facture chez PayDunya.
        $reservation = $this->reservation();
        Paiement::create([
            'reservation_id' => $reservation->id, 'methode' => 'wave',
            'montant' => 200000, 'reference' => 'MV-XYZ', 'statut' => 'en_attente',
            'token_paydunya' => 'JETON-SECRET',
        ]);

        $this->actingAs($reservation->client, 'sanctum')
            ->getJson("/api/reservations/{$reservation->id}")
            ->assertOk()
            ->assertDontSee('JETON-SECRET');

        $this->actingAs($reservation->client, 'sanctum')
            ->getJson('/api/reservations')
            ->assertOk()
            ->assertDontSee('JETON-SECRET');
    }

    public function test_le_proprietaire_voit_si_la_reservation_est_payee(): void
    {
        // C'est ce qui décide s'il remet les clés.
        $reservation = $this->reservation();
        Paiement::create([
            'reservation_id' => $reservation->id, 'methode' => 'wave',
            'montant' => 200000, 'reference' => 'MV-OK', 'statut' => 'reussi',
            'paye_le' => now(),
        ]);

        $this->actingAs($reservation->logement->villa->proprietaire, 'sanctum')
            ->getJson('/api/reservations')
            ->assertOk()
            ->assertJsonPath('0.paiement.statut', 'reussi');
    }
}
