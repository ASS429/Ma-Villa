<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Une adresse d'API collée dans la barre du navigateur ne peut pas
 * s'authentifier : le jeton vit dans le stockage local, pas dans un cookie.
 * « Unauthenticated. » est juste, mais laisse croire à une session expirée et
 * invite à réessayer — ce qui ne changera jamais rien.
 */
class MessageNonAuthentifieTest extends TestCase
{
    use RefreshDatabase;

    /** Une navigation de navigateur : elle demande du HTML. */
    private function commeUnOnglet(string $url)
    {
        return $this->get($url, ['Accept' => 'text/html,application/xhtml+xml']);
    }

    public function test_une_adresse_ouverte_dans_un_onglet_explique_pourquoi(): void
    {
        $reponse = $this->commeUnOnglet('/api/admin/diagnostic/notifications');

        $reponse->assertStatus(401);
        $message = $reponse->json('message');

        $this->assertStringContainsString('ne peut pas être ouverte', $message);
        // Et dit où aller, plutôt que de laisser chercher.
        $this->assertStringContainsString('console', $message);
        $this->assertStringContainsString('Notifications', $message);
    }

    public function test_une_route_privee_non_admin_explique_aussi(): void
    {
        $reponse = $this->commeUnOnglet('/api/reservations');

        $reponse->assertStatus(401);
        $this->assertStringContainsString('jeton', $reponse->json('message'));
        // Pas de renvoi vers la console : cette route n'y a pas d'écran.
        $this->assertStringNotContainsString('Administration →', $reponse->json('message'));
    }

    /**
     * L'application, elle, demande du JSON et doit garder la réponse
     * habituelle : le front teste le code 401, et un message plus long n'a
     * aucune raison de remonter jusqu'à un utilisateur qui n'a rien collé.
     */
    public function test_l_application_garde_le_message_standard(): void
    {
        $reponse = $this->getJson('/api/admin/diagnostic/notifications');

        $reponse->assertStatus(401)->assertJson(['message' => 'Unauthenticated.']);
    }

    /** Un administrateur authentifié n'est évidemment pas concerné. */
    public function test_un_admin_authentifie_atteint_la_sonde(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
             ->getJson('/api/admin/diagnostic/notifications')
             ->assertOk();
    }
}
