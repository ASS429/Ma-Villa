<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use App\Notifications\VerifierAdresseEmail;
use Tests\TestCase;

/**
 * Durcissements trouvés à l'audit du 18 août 2026. Chacun de ces tests a
 * d'abord échoué sur le code en place.
 */
class DurcissementTest extends TestCase
{
    use RefreshDatabase;

    /* ── Changement d'adresse email ──────────────────────────────── */

    /**
     * Changer d'adresse doit reprendre la vérification à zéro.
     *
     * Sinon le compte reste marqué « vérifié » sur une adresse que personne
     * n'a jamais confirmée — y compris celle de quelqu'un d'autre. Toute la
     * garantie apportée par la vérification tombe.
     */
    public function test_changer_d_adresse_annule_la_verification(): void
    {
        Notification::fake();

        $user = User::factory()->client()->create([
            'email' => 'ancienne@example.com',
            'email_verified_at' => now(),
        ]);

        $this->actingAs($user, 'sanctum')
             ->patchJson('/api/auth/profile', ['email' => 'nouvelle@example.com'])
             ->assertOk();

        $user->refresh();

        $this->assertSame('nouvelle@example.com', $user->email);
        $this->assertNull($user->email_verified_at, 'La nouvelle adresse ne doit pas hériter de la vérification.');
        Notification::assertSentTo($user, VerifierAdresseEmail::class);
    }

    public function test_garder_la_meme_adresse_conserve_la_verification(): void
    {
        $user = User::factory()->client()->create([
            'email' => 'stable@example.com',
            'email_verified_at' => $verifieLe = now()->subDay(),
        ]);

        $this->actingAs($user, 'sanctum')
             ->patchJson('/api/auth/profile', [
                 'email' => 'stable@example.com',
                 'name'  => 'Nouveau nom',
             ])->assertOk();

        $user->refresh();

        $this->assertNotNull($user->email_verified_at);
        $this->assertSame($verifieLe->toDateTimeString(), $user->email_verified_at->toDateTimeString());
    }

    /* ── Changement de mot de passe ──────────────────────────────── */

    /**
     * Changer son mot de passe doit fermer les autres sessions.
     *
     * C'est le geste de quelqu'un qui pense son compte compromis. Laisser
     * vivre les jetons déjà émis rend le geste inutile : celui qui est entré
     * y reste.
     */
    public function test_changer_de_mot_de_passe_revoque_les_autres_jetons(): void
    {
        $user = User::factory()->client()->create();

        $intrus = $user->createToken('session-intruse');
        $courant = $user->createToken('session-courante');

        $this->withHeader('Authorization', 'Bearer '.$courant->plainTextToken)
             ->patchJson('/api/auth/profile', [
                 'current_password'      => 'password',
                 'password'              => 'NouveauSecret123',
                 'password_confirmation' => 'NouveauSecret123',
             ])->assertOk();

        // Le jeton de l'intrus n'existe plus ; celui qui a fait le changement
        // survit, sans quoi l'utilisateur se déconnecterait lui-même.
        //
        // L'assertion porte sur la base et non sur une seconde requête : dans
        // un même test, le garde mémorise l'utilisateur déjà résolu et
        // authentifierait un jeton pourtant supprimé.
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $intrus->accessToken->id]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $courant->accessToken->id]);
        $this->assertSame(1, $user->tokens()->count());
    }

    /* ── Suppression de comptes par l'administrateur ─────────────── */

    /**
     * Une plateforme sans administrateur ne se répare pas depuis l'interface :
     * validation des villas, modération et sonde de paiement deviennent
     * inatteignables. Le clic est à un pixel de « supprimer cet utilisateur ».
     */
    public function test_un_admin_ne_peut_pas_supprimer_son_propre_compte(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
             ->deleteJson("/api/admin/utilisateurs/{$admin->id}")
             ->assertStatus(422);

        $this->assertDatabaseHas('users', ['id' => $admin->id]);
    }

    public function test_un_admin_ne_peut_pas_supprimer_un_autre_admin(): void
    {
        $admin = User::factory()->admin()->create();
        $collegue = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
             ->deleteJson("/api/admin/utilisateurs/{$collegue->id}")
             ->assertStatus(422);

        $this->assertDatabaseHas('users', ['id' => $collegue->id]);
    }

    public function test_un_admin_peut_toujours_supprimer_un_client(): void
    {
        $admin = User::factory()->admin()->create();
        $client = User::factory()->client()->create();

        $this->actingAs($admin, 'sanctum')
             ->deleteJson("/api/admin/utilisateurs/{$client->id}")
             ->assertOk();

        $this->assertDatabaseMissing('users', ['id' => $client->id]);
    }
}
