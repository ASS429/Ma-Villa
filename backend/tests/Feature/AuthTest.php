<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    // ── Register ────────────────────────────────────────────────

    public function test_client_can_register(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name'                  => 'Awa Diallo',
            'email'                 => 'awa@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
            'role'                  => 'client',
        ]);

        $response->assertStatus(201)
                 ->assertJsonStructure(['user' => ['id', 'name', 'email', 'role'], 'token']);

        $this->assertEquals('client', $response->json('user.role'));
        $this->assertDatabaseHas('users', ['email' => 'awa@example.com']);
    }

    public function test_proprietaire_can_register(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name'                  => 'Moussa Sow',
            'email'                 => 'moussa@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
            'role'                  => 'proprietaire',
        ]);

        $response->assertStatus(201);
        $this->assertEquals('proprietaire', $response->json('user.role'));
    }

    public function test_register_fails_with_duplicate_email(): void
    {
        User::factory()->create(['email' => 'exist@example.com']);

        $this->postJson('/api/auth/register', [
            'name'                  => 'Test',
            'email'                 => 'exist@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ])->assertStatus(422)->assertJsonValidationErrors(['email']);
    }

    public function test_register_fails_when_passwords_dont_match(): void
    {
        $this->postJson('/api/auth/register', [
            'name'                  => 'Test',
            'email'                 => 'test@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'different',
        ])->assertStatus(422)->assertJsonValidationErrors(['password']);
    }

    public function test_register_requires_minimum_password_length(): void
    {
        $this->postJson('/api/auth/register', [
            'name'                  => 'Test',
            'email'                 => 'test@example.com',
            'password'              => 'short',
            'password_confirmation' => 'short',
        ])->assertStatus(422)->assertJsonValidationErrors(['password']);
    }

    // ── Login ────────────────────────────────────────────────────

    public function test_user_can_login(): void
    {
        $user = User::factory()->client()->create();

        $response = $this->postJson('/api/auth/login', [
            'email'    => $user->email,
            'password' => 'password',
        ]);

        $response->assertOk()
                 ->assertJsonStructure(['user', 'token']);
    }

    public function test_login_fails_with_wrong_password(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/auth/login', [
            'email'    => $user->email,
            'password' => 'wrongpassword',
        ])->assertStatus(422);
    }

    public function test_login_fails_with_unknown_email(): void
    {
        $this->postJson('/api/auth/login', [
            'email'    => 'nobody@example.com',
            'password' => 'password',
        ])->assertStatus(422);
    }

    // ── Me / Logout ──────────────────────────────────────────────

    public function test_authenticated_user_can_get_own_info(): void
    {
        $user = User::factory()->client()->create();

        $this->actingAs($user, 'sanctum')
             ->getJson('/api/auth/me')
             ->assertOk()
             ->assertJsonFragment(['email' => $user->email, 'role' => 'client']);
    }

    public function test_unauthenticated_cannot_get_me(): void
    {
        $this->getJson('/api/auth/me')->assertStatus(401);
    }

    public function test_user_can_logout(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
             ->postJson('/api/auth/logout')
             ->assertOk();
    }

    // ── Profile update ───────────────────────────────────────────

    public function test_user_can_update_name_and_phone(): void
    {
        $user = User::factory()->client()->create();

        $response = $this->actingAs($user, 'sanctum')
             ->patchJson('/api/auth/profile', [
                 'name'  => 'Nouveau Nom',
                 'email' => $user->email,
                 'phone' => '+221 77 123 45 67',
             ]);

        $response->assertOk()->assertJsonFragment(['name' => 'Nouveau Nom', 'phone' => '+221 77 123 45 67']);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Nouveau Nom']);
    }

    public function test_user_can_change_password(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
             ->patchJson('/api/auth/profile', [
                 'current_password'      => 'password',
                 'password'              => 'newpassword123',
                 'password_confirmation' => 'newpassword123',
             ])->assertOk();

        // Nouvelle connexion doit fonctionner
        $this->postJson('/api/auth/login', [
            'email'    => $user->email,
            'password' => 'newpassword123',
        ])->assertOk();
    }

    public function test_wrong_current_password_is_rejected(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
             ->patchJson('/api/auth/profile', [
                 'current_password'      => 'wrongpassword',
                 'password'              => 'newpassword123',
                 'password_confirmation' => 'newpassword123',
             ])->assertStatus(422)->assertJsonValidationErrors(['current_password']);
    }

    public function test_email_must_be_unique_on_profile_update(): void
    {
        $other = User::factory()->create(['email' => 'taken@example.com']);
        $user  = User::factory()->create();

        $this->actingAs($user, 'sanctum')
             ->patchJson('/api/auth/profile', [
                 'name'  => $user->name,
                 'email' => 'taken@example.com',
             ])->assertStatus(422)->assertJsonValidationErrors(['email']);
    }
}
