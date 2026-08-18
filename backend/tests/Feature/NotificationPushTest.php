<?php

namespace Tests\Feature;

use App\Models\AbonnementPush;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationPushTest extends TestCase
{
    use RefreshDatabase;

    /** Des clés VAPID plausibles : le contrôleur ne vérifie que leur présence. */
    private function avecClesVapid(): void
    {
        config([
            'push.actif' => true,
            'push.vapid.publique' => 'BFxRDAF2ETmHp3mjr9CyR6jCdemonstrationdecletestpublique1234567890abcd',
            'push.vapid.privee' => 'cle-privee-de-test',
        ]);
    }

    private function abonnement(array $remplace = []): array
    {
        return array_merge([
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/abc123',
            'cle_p256dh' => 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=',
            'cle_auth' => 'tBHItJI5svbpez7KI4CCXg==',
        ], $remplace);
    }

    /* ── Configuration exposée ───────────────────────────────────── */

    public function test_la_configuration_annonce_les_notifications_quand_les_cles_sont_posees(): void
    {
        $this->avecClesVapid();

        $this->getJson('/api/configuration')
             ->assertOk()
             ->assertJsonPath('notifications.actives', true)
             ->assertJsonPath('notifications.cle_publique', config('push.vapid.publique'));
    }

    /**
     * Sans clés, la fonction doit rester invisible : un bouton « activer »
     * qui échoue vaut moins que pas de bouton du tout.
     */
    public function test_sans_cles_la_configuration_n_annonce_aucune_notification(): void
    {
        config(['push.vapid.publique' => '', 'push.vapid.privee' => '']);

        $this->getJson('/api/configuration')
             ->assertOk()
             ->assertJsonPath('notifications.actives', false)
             ->assertJsonPath('notifications.cle_publique', null);
    }

    /* ── Abonnement ──────────────────────────────────────────────── */

    public function test_un_utilisateur_connecte_peut_abonner_son_appareil(): void
    {
        $this->avecClesVapid();
        $user = User::factory()->client()->create();

        $this->actingAs($user, 'sanctum')
             ->postJson('/api/notifications/abonnement', $this->abonnement())
             ->assertStatus(201);

        $this->assertDatabaseHas('abonnements_push', [
            'user_id' => $user->id,
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/abc123',
        ]);
    }

    public function test_un_visiteur_non_connecte_ne_peut_pas_s_abonner(): void
    {
        $this->avecClesVapid();

        $this->postJson('/api/notifications/abonnement', $this->abonnement())
             ->assertStatus(401);
    }

    /**
     * Le même navigateur qui réautorise renvoie le même endpoint. En créer un
     * second livrerait chaque notification en double, sans que rien dans
     * l'interface n'explique pourquoi.
     */
    public function test_reabonner_le_meme_appareil_remplace_au_lieu_de_doubler(): void
    {
        $this->avecClesVapid();
        $user = User::factory()->client()->create();

        $this->actingAs($user, 'sanctum')
             ->postJson('/api/notifications/abonnement', $this->abonnement())
             ->assertStatus(201);

        $this->actingAs($user, 'sanctum')
             ->postJson('/api/notifications/abonnement', $this->abonnement(['cle_auth' => 'nouvelleCleAuth==']))
             ->assertStatus(201);

        $this->assertSame(1, AbonnementPush::count());
        $this->assertSame('nouvelleCleAuth==', AbonnementPush::first()->cle_auth);
    }

    public function test_un_endpoint_qui_n_est_pas_une_url_est_refuse(): void
    {
        $this->avecClesVapid();
        $user = User::factory()->client()->create();

        $this->actingAs($user, 'sanctum')
             ->postJson('/api/notifications/abonnement', $this->abonnement(['endpoint' => 'pas-une-url']))
             ->assertStatus(422);
    }

    public function test_sans_cles_serveur_l_abonnement_est_refuse_franchement(): void
    {
        config(['push.vapid.publique' => '', 'push.vapid.privee' => '']);
        $user = User::factory()->client()->create();

        $this->actingAs($user, 'sanctum')
             ->postJson('/api/notifications/abonnement', $this->abonnement())
             ->assertStatus(503);
    }

    /* ── Désabonnement ───────────────────────────────────────────── */

    public function test_un_utilisateur_peut_couper_les_notifications_de_son_appareil(): void
    {
        $this->avecClesVapid();
        $user = User::factory()->client()->create();
        $this->actingAs($user, 'sanctum')->postJson('/api/notifications/abonnement', $this->abonnement());

        $this->actingAs($user, 'sanctum')
             ->deleteJson('/api/notifications/abonnement', ['endpoint' => $this->abonnement()['endpoint']])
             ->assertOk();

        $this->assertSame(0, AbonnementPush::count());
    }

    /**
     * Un endpoint n'est pas un secret : il transite par le service de poussée.
     * Le connaître ne doit pas suffire à faire taire l'appareil d'autrui.
     */
    public function test_on_ne_peut_pas_desabonner_l_appareil_de_quelqu_un_d_autre(): void
    {
        $this->avecClesVapid();
        $proprietaire = User::factory()->client()->create();
        $intrus = User::factory()->client()->create();

        $this->actingAs($proprietaire, 'sanctum')
             ->postJson('/api/notifications/abonnement', $this->abonnement());

        $this->actingAs($intrus, 'sanctum')
             ->deleteJson('/api/notifications/abonnement', ['endpoint' => $this->abonnement()['endpoint']])
             ->assertOk();

        $this->assertSame(1, AbonnementPush::count(), "L'abonnement d'autrui doit survivre.");
    }

    /**
     * Les clés servent au chiffrement de bout en bout de la charge utile :
     * elles n'ont aucune raison de repasser par une réponse d'API.
     */
    public function test_les_cles_de_chiffrement_ne_sortent_jamais_de_l_api(): void
    {
        $this->avecClesVapid();
        $user = User::factory()->client()->create();

        $reponse = $this->actingAs($user, 'sanctum')
             ->postJson('/api/notifications/abonnement', $this->abonnement());

        $reponse->assertStatus(201);
        $corps = $reponse->getContent();

        $this->assertStringNotContainsString('cle_p256dh', $corps);
        $this->assertStringNotContainsString('cle_auth', $corps);
        $this->assertStringNotContainsString($this->abonnement()['cle_auth'], $corps);
    }

    /** Un compte supprimé ne doit pas laisser d'appareil qu'on continuerait à joindre. */
    public function test_supprimer_un_compte_emporte_ses_abonnements(): void
    {
        $this->avecClesVapid();
        $user = User::factory()->client()->create();
        $this->actingAs($user, 'sanctum')->postJson('/api/notifications/abonnement', $this->abonnement());

        $user->delete();

        $this->assertSame(0, AbonnementPush::count());
    }
}
