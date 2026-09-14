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
 * La réservation en ligne suspendue.
 *
 * Posée le 14 septembre 2026 : le compte PayDunya est bloqué par une
 * vérification d'identité, et encaisser dessus prendrait l'argent d'un client
 * sans savoir quand on pourrait le lui rendre.
 *
 * Ces tests fixent trois choses :
 *
 *   — le refus est **côté serveur** : l'application mobile déjà distribuée
 *     n'affiche que ce que l'API lui répond ;
 *   — ce refus **porte le contact** en toutes lettres, pour la même raison ;
 *   — tout le reste du parcours **reste ouvert** : suspendre la réservation ne
 *     doit pas empêcher d'annuler, ni cacher un paiement déjà lancé.
 */
class ReservationsSuspenduesTest extends TestCase
{
    use RefreshDatabase;

    private User $client;

    private Logement $logement;

    private Tarif $tarif;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'reservations.ouvertes'          => false,
            'reservations.contact.nom'       => 'Abdou Ndour',
            'reservations.contact.telephone' => '+221 77 868 47 23',
            'reservations.contact.email'     => 'ndourabdou011@gmail.com',
            // Le paiement reste « actif » : la suspension doit fermer le
            // règlement d'elle-même, sans compter sur une seconde bascule.
            'paiement.actif'                 => true,
        ]);

        $proprietaire = User::factory()->proprietaire()->create(['phone' => '+221 77 111 22 33']);
        $villa = Villa::factory()->validee()->create(['user_id' => $proprietaire->id]);

        $this->logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'villa_entiere',
            'capacite' => 4, 'disponible' => true,
        ]);
        $this->tarif = Tarif::create([
            'logement_id' => $this->logement->id, 'type_tarif' => 'nuitee',
            'prix' => 40000, 'avec_clim' => false, 'avec_buffet' => false,
        ]);

        $this->client = User::factory()->client()->create();
    }

    /** @return array<string, mixed> */
    private function demande(): array
    {
        return [
            'logement_id'  => $this->logement->id,
            'tarif_id'     => $this->tarif->id,
            'date_debut'   => now()->addDays(10)->toDateString(),
            'date_fin'     => now()->addDays(12)->toDateString(),
            'nb_personnes' => 2,
        ];
    }

    private function reservationExistante(): Reservation
    {
        return Reservation::create($this->demande() + [
            'user_id'       => $this->client->id,
            'montant_total' => 80000,
            'statut'        => 'en_attente',
        ]);
    }

    /* ── Ce qui est fermé ─────────────────────────────────────────── */

    public function test_une_demande_de_reservation_est_refusee_avec_le_contact(): void
    {
        $reponse = $this->actingAs($this->client)
            ->postJson('/api/reservations', $this->demande())
            ->assertStatus(503)
            ->assertJsonPath('suspendu', true)
            ->assertJsonPath('contact.nom', 'Abdou Ndour');

        // Le message seul doit suffire : c'est tout ce que l'application
        // mobile déjà distribuée affichera.
        $this->assertStringContainsString('+221 77 868 47 23', $reponse->json('message'));
        $this->assertStringContainsString('ndourabdou011@gmail.com', $reponse->json('message'));

        $this->assertDatabaseCount('reservations', 0);
    }

    /**
     * Une demande créée avant la suspension ne doit pas pouvoir être réglée :
     * ce serait encaisser sur le compte bloqué par la porte de derrière.
     */
    public function test_le_reglement_d_une_demande_existante_est_refuse(): void
    {
        $reservation = $this->reservationExistante();

        $this->actingAs($this->client)
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode'   => 'wave',
                'telephone' => '+221 77 000 00 00',
            ])
            ->assertStatus(503)
            ->assertJsonPath('suspendu', true);

        $this->assertDatabaseCount('paiements', 0);
    }

    public function test_la_configuration_annonce_la_suspension_et_le_contact(): void
    {
        $this->getJson('/api/configuration')
            ->assertOk()
            ->assertJsonPath('reservations.ouvertes', false)
            ->assertJsonPath('reservations.contact.telephone', '+221 77 868 47 23')
            ->assertJsonPath('reservations.contact.email', 'ndourabdou011@gmail.com');
    }

    /* ── Ce qui reste ouvert ──────────────────────────────────────── */

    /** Suspendre la réservation n'enferme personne dans une demande. */
    public function test_on_peut_toujours_annuler_une_demande(): void
    {
        $reservation = $this->reservationExistante();

        $this->actingAs($this->client)
            ->patchJson("/api/reservations/{$reservation->id}/statut", ['statut' => 'annulee'])
            ->assertOk();

        $this->assertSame('annulee', $reservation->refresh()->statut);
    }

    /**
     * La vérification d'un paiement reste ouverte : la fermer laisserait un
     * client débité sans confirmation de sa réservation.
     */
    public function test_la_verification_d_un_paiement_n_est_pas_suspendue(): void
    {
        $reservation = $this->reservationExistante();

        $statut = $this->actingAs($this->client)
            ->getJson("/api/reservations/{$reservation->id}/paiement")
            ->status();

        $this->assertNotSame(503, $statut);
    }

    /** Rouvrir tient en une variable, sans rien redéployer. */
    public function test_rouvrir_suffit_a_reautoriser_la_demande(): void
    {
        config(['reservations.ouvertes' => true]);

        $this->actingAs($this->client)
            ->postJson('/api/reservations', $this->demande())
            ->assertSuccessful();

        $this->getJson('/api/configuration')->assertJsonPath('reservations.ouvertes', true);
    }
}
