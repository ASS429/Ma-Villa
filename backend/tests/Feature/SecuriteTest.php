<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use App\Notifications\NouvelleReservation;
use App\Notifications\ReinitialiserMotDePasse;
use App\Notifications\ReservationMiseAJour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Couvre les correctifs de sécurité et les parcours ajoutés avant lancement.
 */
class SecuriteTest extends TestCase
{
    use RefreshDatabase;

    private function reservation(): array
    {
        $proprietaire = User::factory()->proprietaire()->create();
        $villa = Villa::factory()->validee()->create(['user_id' => $proprietaire->id]);
        $logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'villa_entiere',
            'capacite' => 6, 'disponible' => true,
        ]);
        $tarif = Tarif::create([
            'logement_id' => $logement->id, 'type_tarif' => 'nuitee', 'prix' => 100000,
            'avec_clim' => false, 'avec_buffet' => false,
        ]);
        $client = User::factory()->client()->create();
        $reservation = Reservation::create([
            'user_id' => $client->id, 'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
            'date_debut' => now()->addDays(5)->toDateString(),
            'date_fin' => now()->addDays(8)->toDateString(),
            'nb_personnes' => 2, 'montant_total' => 300000, 'statut' => 'en_attente',
        ]);

        return compact('proprietaire', 'villa', 'logement', 'tarif', 'client', 'reservation');
    }

    // ── Fuite de données sur GET /reservations/{id} ──────────────

    public function test_un_tiers_ne_peut_pas_lire_la_reservation_dun_autre(): void
    {
        ['reservation' => $reservation] = $this->reservation();
        $intrus = User::factory()->client()->create();

        $this->actingAs($intrus, 'sanctum')
             ->getJson("/api/reservations/{$reservation->id}")
             ->assertForbidden();
    }

    public function test_le_client_lit_sa_propre_reservation(): void
    {
        ['reservation' => $reservation, 'client' => $client] = $this->reservation();

        $this->actingAs($client, 'sanctum')
             ->getJson("/api/reservations/{$reservation->id}")
             ->assertOk()
             ->assertJsonFragment(['id' => $reservation->id]);
    }

    public function test_le_proprietaire_lit_la_reservation_de_son_logement(): void
    {
        ['reservation' => $reservation, 'proprietaire' => $proprietaire] = $this->reservation();

        $this->actingAs($proprietaire, 'sanctum')
             ->getJson("/api/reservations/{$reservation->id}")
             ->assertOk();
    }

    public function test_un_visiteur_anonyme_ne_lit_aucune_reservation(): void
    {
        ['reservation' => $reservation] = $this->reservation();

        $this->getJson("/api/reservations/{$reservation->id}")->assertUnauthorized();
    }

    // ── Avis conditionnés à un séjour réel ───────────────────────

    public function test_un_client_sans_sejour_ne_peut_pas_noter(): void
    {
        ['villa' => $villa] = $this->reservation();
        $client = User::factory()->client()->create();

        $this->actingAs($client, 'sanctum')
             ->postJson('/api/avis', ['villa_id' => $villa->id, 'note' => 5])
             ->assertForbidden();

        $this->assertDatabaseCount('avis', 0);
    }

    public function test_un_proprietaire_ne_peut_pas_noter_sa_propre_villa(): void
    {
        ['villa' => $villa, 'proprietaire' => $proprietaire] = $this->reservation();

        $this->actingAs($proprietaire, 'sanctum')
             ->postJson('/api/avis', ['villa_id' => $villa->id, 'note' => 5])
             ->assertForbidden();
    }

    public function test_un_client_ayant_sejourne_peut_noter(): void
    {
        ['villa' => $villa, 'client' => $client, 'reservation' => $reservation] = $this->reservation();

        $reservation->update([
            'statut'     => 'confirmee',
            'date_debut' => now()->subDays(10)->toDateString(),
            'date_fin'   => now()->subDays(7)->toDateString(),
        ]);

        $this->actingAs($client, 'sanctum')
             ->postJson('/api/avis', ['villa_id' => $villa->id, 'note' => 5, 'commentaire' => 'Parfait'])
             ->assertStatus(201);

        $this->assertDatabaseHas('avis', ['villa_id' => $villa->id, 'user_id' => $client->id, 'note' => 5]);
    }

    public function test_un_sejour_non_termine_ne_permet_pas_encore_de_noter(): void
    {
        ['villa' => $villa, 'client' => $client, 'reservation' => $reservation] = $this->reservation();
        $reservation->update(['statut' => 'confirmee']); // dates encore à venir

        $this->actingAs($client, 'sanctum')
             ->postJson('/api/avis', ['villa_id' => $villa->id, 'note' => 5])
             ->assertForbidden();
    }

    // ── Notifications ────────────────────────────────────────────

    public function test_le_proprietaire_est_notifie_dune_nouvelle_demande(): void
    {
        Notification::fake();
        ['logement' => $logement, 'tarif' => $tarif, 'proprietaire' => $proprietaire] = $this->reservation();
        $client = User::factory()->client()->create();

        $this->actingAs($client, 'sanctum')->postJson('/api/reservations', [
            'logement_id'  => $logement->id,
            'tarif_id'     => $tarif->id,
            'date_debut'   => now()->addDays(40)->toDateString(),
            'date_fin'     => now()->addDays(43)->toDateString(),
            'nb_personnes' => 2,
        ])->assertStatus(201);

        Notification::assertSentTo($proprietaire, NouvelleReservation::class);
    }

    public function test_le_client_est_notifie_de_la_confirmation(): void
    {
        Notification::fake();
        ['reservation' => $reservation, 'proprietaire' => $proprietaire, 'client' => $client] = $this->reservation();

        $this->actingAs($proprietaire, 'sanctum')
             ->patchJson("/api/reservations/{$reservation->id}/statut", ['statut' => 'confirmee'])
             ->assertOk();

        Notification::assertSentTo($client, ReservationMiseAJour::class);
    }

    public function test_le_client_qui_annule_ne_se_notifie_pas_lui_meme(): void
    {
        Notification::fake();
        ['reservation' => $reservation, 'client' => $client] = $this->reservation();

        $this->actingAs($client, 'sanctum')
             ->patchJson("/api/reservations/{$reservation->id}/statut", ['statut' => 'annulee'])
             ->assertOk();

        Notification::assertNothingSentTo($client);
    }

    // ── Mot de passe oublié ──────────────────────────────────────

    public function test_une_demande_de_reinitialisation_envoie_un_lien(): void
    {
        Notification::fake();
        $user = User::factory()->client()->create();

        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertOk();

        Notification::assertSentTo($user, ReinitialiserMotDePasse::class);
    }

    public function test_une_adresse_inconnue_ne_revele_rien(): void
    {
        Notification::fake();

        $this->postJson('/api/auth/forgot-password', ['email' => 'inconnu@example.com'])
             ->assertOk()
             ->assertJsonPath('message', 'Si un compte existe avec cette adresse, un lien de réinitialisation vient d\'être envoyé.');

        Notification::assertNothingSent();
    }

    public function test_la_reinitialisation_change_le_mot_de_passe_et_revoque_les_jetons(): void
    {
        $user = User::factory()->client()->create();
        $user->createToken('ancien')->plainTextToken;
        $token = \Illuminate\Support\Facades\Password::createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'nouveau-mot-de-passe',
            'password_confirmation' => 'nouveau-mot-de-passe',
        ])->assertOk();

        $this->assertTrue(
            \Illuminate\Support\Facades\Hash::check('nouveau-mot-de-passe', $user->fresh()->password)
        );
        $this->assertCount(0, $user->fresh()->tokens);
    }

    public function test_un_jeton_de_reinitialisation_invalide_est_refuse(): void
    {
        $user = User::factory()->client()->create();

        $this->postJson('/api/auth/reset-password', [
            'token' => 'jeton-bidon',
            'email' => $user->email,
            'password' => 'nouveau-mot-de-passe',
            'password_confirmation' => 'nouveau-mot-de-passe',
        ])->assertStatus(422);
    }

    // ── Vérification d'adresse email ─────────────────────────────

    public function test_linscription_envoie_un_email_de_verification(): void
    {
        Notification::fake();

        $this->postJson('/api/auth/register', [
            'name' => 'Awa Diop',
            'email' => 'awa@example.com',
            'password' => 'mot-de-passe-solide',
            'password_confirmation' => 'mot-de-passe-solide',
            'role' => 'client',
        ])->assertStatus(201);

        Notification::assertSentTo(
            User::where('email', 'awa@example.com')->first(),
            \App\Notifications\VerifierAdresseEmail::class
        );
    }

    public function test_on_ne_peut_pas_sinscrire_comme_admin(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Pirate',
            'email' => 'pirate@example.com',
            'password' => 'mot-de-passe-solide',
            'password_confirmation' => 'mot-de-passe-solide',
            'role' => 'admin',
        ])->assertStatus(422);
    }

    // ── Réservation : garde-fous ajoutés ─────────────────────────

    public function test_on_ne_peut_pas_depasser_la_capacite_du_logement(): void
    {
        ['logement' => $logement, 'tarif' => $tarif] = $this->reservation();
        $client = User::factory()->client()->create();

        $this->actingAs($client, 'sanctum')->postJson('/api/reservations', [
            'logement_id'  => $logement->id,
            'tarif_id'     => $tarif->id,
            'date_debut'   => now()->addDays(40)->toDateString(),
            'date_fin'     => now()->addDays(42)->toDateString(),
            'nb_personnes' => 99,
        ])->assertStatus(422);
    }

    public function test_on_ne_peut_pas_reserver_un_logement_retire(): void
    {
        ['logement' => $logement, 'tarif' => $tarif] = $this->reservation();
        $logement->update(['disponible' => false]);
        $client = User::factory()->client()->create();

        $this->actingAs($client, 'sanctum')->postJson('/api/reservations', [
            'logement_id'  => $logement->id,
            'tarif_id'     => $tarif->id,
            'date_debut'   => now()->addDays(40)->toDateString(),
            'date_fin'     => now()->addDays(42)->toDateString(),
            'nb_personnes' => 2,
        ])->assertStatus(409);
    }

    public function test_on_ne_peut_pas_reserver_une_periode_bloquee_par_le_proprietaire(): void
    {
        ['logement' => $logement, 'tarif' => $tarif] = $this->reservation();
        $logement->disponibilites()->create([
            'date_debut' => now()->addDays(39)->toDateString(),
            'date_fin'   => now()->addDays(45)->toDateString(),
            'disponible' => false,
            'motif'      => 'Travaux',
        ]);
        $client = User::factory()->client()->create();

        $this->actingAs($client, 'sanctum')->postJson('/api/reservations', [
            'logement_id'  => $logement->id,
            'tarif_id'     => $tarif->id,
            'date_debut'   => now()->addDays(40)->toDateString(),
            'date_fin'     => now()->addDays(42)->toDateString(),
            'nb_personnes' => 2,
        ])->assertStatus(409);
    }

    public function test_le_peuplement_ne_laisse_aucun_compte_ouvert_en_production(): void
    {
        // « password » est écrit dans un dépôt public et le peuplement rejoue à
        // chaque déploiement : admin@mavilla.sn donnait les pleins pouvoirs sur
        // la production à quiconque lisait ce fichier.
        app()['env'] = 'production';

        // Instancié directement : passer par `db:seed` déclencherait la
        // confirmation interactive que Laravel impose en production.
        (new \Database\Seeders\VillaSeeder())->run();

        $comptes = \App\Models\User::whereIn('email', [
            'admin@mavilla.sn',
            'amadou.diallo@mavilla.sn',
            'sophie.martin@gmail.com',
        ])->get();

        $this->assertCount(3, $comptes);

        foreach ($comptes as $compte) {
            $this->assertFalse(
                \Illuminate\Support\Facades\Hash::check('password', $compte->password),
                "Le compte {$compte->email} accepte encore « password »."
            );
        }
    }

    public function test_un_mot_de_passe_fourni_par_l_environnement_fait_foi(): void
    {
        // Sinon l'exploitant n'aurait aucun moyen de reprendre la main sur son
        // propre compte d'administration.
        app()['env'] = 'production';
        config(['app.env' => 'production']);
        putenv('ADMIN_PASSWORD=un-secret-choisi-par-lexploitant');

        try {
            // Instancié directement : passer par `db:seed` déclencherait la
        // confirmation interactive que Laravel impose en production.
        (new \Database\Seeders\VillaSeeder())->run();

            $admin = \App\Models\User::where('email', 'admin@mavilla.sn')->firstOrFail();
            $this->assertTrue(
                \Illuminate\Support\Facades\Hash::check('un-secret-choisi-par-lexploitant', $admin->password)
            );
        } finally {
            putenv('ADMIN_PASSWORD');
        }
    }

    public function test_une_route_api_ouverte_dans_un_navigateur_repond_401_pas_500(): void
    {
        // Ce back n'expose aucune route « login » : sans règle explicite,
        // Laravel cherchait une redirection inexistante et répondait « Server
        // Error ». Un diagnostic devenait alors un second bug à élucider.
        $this->get('/api/admin/diagnostic/paiement', ['Accept' => 'text/html'])
             ->assertStatus(401);

        $this->get('/api/reservations', ['Accept' => 'text/html'])
             ->assertStatus(401);
    }
}
