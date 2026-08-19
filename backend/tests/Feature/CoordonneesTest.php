<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Les coordonnées ne sortent pas de la plateforme.
 *
 * Deux raisons distinctes, et les deux comptent.
 *
 * **Le modèle économique.** Un numéro affiché sur une fiche permet d'appeler et
 * de convenir d'un séjour hors plateforme : la commission de 10–20 % s'évapore,
 * la réservation n'est plus tracée — donc ni avis vérifié, ni recours en cas de
 * litige, ni preuve de paiement.
 *
 * **Les données personnelles.** L'email et le téléphone d'un propriétaire sont
 * les siens. La relation `proprietaire` partait entière sur une route publique,
 * sans authentification : n'importe qui pouvait les moissonner en parcourant
 * les identifiants.
 */
class CoordonneesTest extends TestCase
{
    use RefreshDatabase;

    private function villaPubliee(): Villa
    {
        $proprietaire = User::factory()->proprietaire()->create([
            'email' => 'proprietaire@mavilla.sn',
            'phone' => '+221 77 000 00 01',
        ]);

        return Villa::factory()->validee()->create([
            'user_id' => $proprietaire->id,
            'telephone' => '+221 77 100 11 01',
        ]);
    }

    public function test_la_liste_publique_ne_porte_aucun_numero(): void
    {
        $this->villaPubliee();

        $reponse = $this->getJson('/api/villas');

        $reponse->assertOk();
        $corps = $reponse->getContent();

        $this->assertStringNotContainsString('77 100 11 01', $corps);
        $this->assertArrayNotHasKey('telephone', $reponse->json('data.0') ?? $reponse->json('0'));
    }

    public function test_la_fiche_publique_ne_porte_aucun_numero(): void
    {
        $villa = $this->villaPubliee();

        $reponse = $this->getJson("/api/villas/{$villa->id}");

        $reponse->assertOk();
        $this->assertArrayNotHasKey('telephone', $reponse->json());
    }

    /**
     * Le plus grave des deux : l'email du propriétaire partait en clair sur une
     * route ouverte à tous.
     */
    public function test_la_fiche_publique_ne_divulgue_ni_email_ni_telephone_du_proprietaire(): void
    {
        $villa = $this->villaPubliee();

        $corps = $this->getJson("/api/villas/{$villa->id}")->getContent();

        $this->assertStringNotContainsString('proprietaire@mavilla.sn', $corps);
        $this->assertStringNotContainsString('77 000 00 01', $corps);

        // Le nom reste : le visiteur doit savoir qui loue.
        $proprietaire = $this->getJson("/api/villas/{$villa->id}")->json('proprietaire');
        $this->assertArrayHasKey('name', $proprietaire);
        $this->assertArrayNotHasKey('email', $proprietaire);
        $this->assertArrayNotHasKey('phone', $proprietaire);
    }

    /** Le propriétaire garde accès au numéro de sa propre villa. */
    public function test_le_proprietaire_voit_le_numero_de_sa_villa(): void
    {
        $villa = $this->villaPubliee();
        $proprietaire = User::find($villa->user_id);

        $this->actingAs($proprietaire, 'sanctum')
             ->getJson("/api/villas/{$villa->id}")
             ->assertOk()
             ->assertJsonPath('telephone', '+221 77 100 11 01');
    }

    /** L'admin aussi : il modère, et doit pouvoir joindre le propriétaire. */
    public function test_l_admin_voit_le_numero(): void
    {
        $villa = $this->villaPubliee();
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
             ->getJson("/api/villas/{$villa->id}")
             ->assertOk()
             ->assertJsonPath('telephone', '+221 77 100 11 01');
    }

    /**
     * Un client connecté sans réservation reste un visiteur : être inscrit ne
     * donne pas droit aux coordonnées.
     */
    public function test_un_client_connecte_sans_reservation_ne_voit_pas_le_numero(): void
    {
        $villa = $this->villaPubliee();
        $client = User::factory()->client()->create();

        $reponse = $this->actingAs($client, 'sanctum')->getJson("/api/villas/{$villa->id}");

        $reponse->assertOk();
        $this->assertArrayNotHasKey('telephone', $reponse->json());
    }

    /* ── Le contournement par la réservation ─────────────────────── */

    /**
     * Retirer le numéro de la fiche ne servait à rien tant qu'une simple
     * demande de réservation le rendait : elle ne coûte rien et ne se paie
     * pas. Il suffisait d'en ouvrir une, de lire la réponse, puis d'annuler.
     */
    public function test_une_reservation_en_attente_ne_revele_pas_le_numero(): void
    {
        ['reservation' => $r, 'client' => $client] = $this->reservation('en_attente');

        $reponse = $this->actingAs($client, 'sanctum')->getJson("/api/reservations/{$r->id}");

        $reponse->assertOk();
        $this->assertArrayNotHasKey('telephone', $reponse->json('logement.villa'));
        $this->assertStringNotContainsString('77 100 11 01', $reponse->getContent());
    }

    public function test_la_liste_des_reservations_en_attente_ne_revele_pas_le_numero(): void
    {
        ['client' => $client] = $this->reservation('en_attente');

        $corps = $this->actingAs($client, 'sanctum')->getJson('/api/reservations')->getContent();

        $this->assertStringNotContainsString('77 100 11 01', $corps);
    }

    /** Une fois le propriétaire engagé, les deux parties doivent se joindre. */
    public function test_une_reservation_confirmee_revele_le_numero(): void
    {
        ['reservation' => $r, 'client' => $client] = $this->reservation('confirmee');

        $this->actingAs($client, 'sanctum')
             ->getJson("/api/reservations/{$r->id}")
             ->assertOk()
             ->assertJsonPath('logement.villa.telephone', '+221 77 100 11 01');
    }

    /**
     * Symétrique : le propriétaire n'a pas à disposer du numéro d'un client
     * dont il n'a pas encore accepté la demande.
     */
    public function test_le_proprietaire_ne_voit_le_telephone_du_client_qu_apres_confirmation(): void
    {
        ['reservation' => $r, 'proprietaire' => $proprio] = $this->reservation('en_attente');

        $avant = $this->actingAs($proprio, 'sanctum')->getJson("/api/reservations/{$r->id}");
        $avant->assertOk();
        $this->assertArrayNotHasKey('phone', $avant->json('client'));

        $r->update(['statut' => 'confirmee']);

        $this->actingAs($proprio, 'sanctum')
             ->getJson("/api/reservations/{$r->id}")
             ->assertJsonPath('client.phone', '+221 77 555 44 33');
    }

    /**
     * Le propriétaire voit toujours le numéro de sa propre villa, même sur une
     * demande qu'il n'a pas encore tranchée : c'est le sien.
     */
    public function test_le_proprietaire_voit_toujours_le_numero_de_sa_villa(): void
    {
        ['reservation' => $r, 'proprietaire' => $proprio] = $this->reservation('en_attente');

        $this->actingAs($proprio, 'sanctum')
             ->getJson("/api/reservations/{$r->id}")
             ->assertJsonPath('logement.villa.telephone', '+221 77 100 11 01');
    }

    /**
     * @return array{reservation: \App\Models\Reservation, client: User, proprietaire: User}
     */
    private function reservation(string $statut): array
    {
        $villa = $this->villaPubliee();
        $proprietaire = User::find($villa->user_id);

        $client = User::factory()->client()->create(['phone' => '+221 77 555 44 33']);

        $logement = \App\Models\Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'villa_entiere',
            'capacite' => 4, 'disponible' => true,
        ]);
        $tarif = \App\Models\Tarif::create([
            'logement_id' => $logement->id, 'type_tarif' => 'nuitee',
            'prix' => 100000, 'avec_clim' => false, 'avec_buffet' => false,
        ]);

        $reservation = \App\Models\Reservation::create([
            'user_id' => $client->id, 'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
            'date_debut' => now()->addDays(5)->toDateString(),
            'date_fin' => now()->addDays(8)->toDateString(),
            'nb_personnes' => 2, 'montant_total' => 300000, 'statut' => $statut,
        ]);

        return compact('reservation', 'client', 'proprietaire');
    }
}
