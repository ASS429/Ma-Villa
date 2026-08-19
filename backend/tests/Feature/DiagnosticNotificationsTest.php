<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * La sonde doit distinguer « configuré » de « fonctionne ».
 *
 * `/api/configuration` annonce les notifications actives dès que les trois
 * variables existent — ce qui suffit à afficher un bouton, mais ne dit rien de
 * la crypto. Une clé tronquée ou une paire dépareillée passe ce contrôle et
 * fait échouer le premier envoi en silence.
 */
class DiagnosticNotificationsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Une paire réellement valide, générée à la volée quand l'environnement le
     * permet. Une paire inventée ferait échouer la signature pour la mauvaise
     * raison — le test passerait au vert sans rien prouver.
     */
    /** Vrai si une paire réellement valide a pu être posée. */
    private function pairePosee(): bool
    {
        config(['push.actif' => true, 'push.vapid.sujet' => 'mailto:contact@mavilla.sn']);

        try {
            $k = \Minishlink\WebPush\VAPID::createVapidKeys();
        } catch (\Throwable) {
            // Sans `gmp`, la génération est impossible ici. Elle l'est en
            // revanche sur un serveur qui l'a — d'où le saut plutôt qu'un échec.
            return false;
        }

        config(['push.vapid.publique' => $k['publicKey'], 'push.vapid.privee' => $k['privateKey']]);

        return true;
    }

    private function avecVraiesCles(): void
    {
        config(['push.actif' => true, 'push.vapid.sujet' => 'mailto:contact@mavilla.sn']);

        try {
            $k = \Minishlink\WebPush\VAPID::createVapidKeys();
            config(['push.vapid.publique' => $k['publicKey'], 'push.vapid.privee' => $k['privateKey']]);
        } catch (\Throwable) {
            // Sans gmp, la génération est impossible : on pose une paire de
            // longueurs correctes pour que la sonde aille jusqu'à l'étape de
            // signature, qui est celle qu'on veut voir échouer.
            $base64url = fn (string $o) => rtrim(strtr(base64_encode($o), '+/', '-_'), '=');

            config([
                // 65 octets ouverts par 0x04 : la forme non compressée
                // qu'attend `validate()`. 32 octets pour la privée.
                'push.vapid.publique' => $base64url(chr(4).str_repeat(chr(1), 64)),
                'push.vapid.privee' => $base64url(str_repeat(chr(1), 32)),
            ]);
        }
    }

    public function test_la_sonde_est_reservee_a_l_administrateur(): void
    {
        $client = User::factory()->client()->create();

        $this->actingAs($client, 'sanctum')
             ->getJson('/api/admin/diagnostic/notifications')
             ->assertStatus(403);
    }

    public function test_la_sonde_est_refusee_sans_authentification(): void
    {
        $this->getJson('/api/admin/diagnostic/notifications')->assertStatus(401);
    }

    /** Sans clés, elle le dit franchement plutôt que de tenter une signature. */
    public function test_sans_cles_la_sonde_annonce_des_notifications_inactives(): void
    {
        config(['push.vapid.publique' => '', 'push.vapid.privee' => '']);
        $admin = User::factory()->admin()->create();

        $reponse = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/diagnostic/notifications');

        $reponse->assertOk()
                ->assertJsonPath('signature.ok', false)
                ->assertJsonPath('verdict', 'Notifications inactives.');
    }

    /**
     * L'état des extensions doit être rapporté quoi qu'il arrive : c'est la
     * première chose à regarder quand un envoi ne part pas.
     */
    public function test_la_sonde_rapporte_l_etat_des_extensions(): void
    {
        $this->avecVraiesCles();
        $admin = User::factory()->admin()->create();

        $reponse = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/diagnostic/notifications');

        $reponse->assertOk()->assertJsonStructure([
            'extensions' => ['gmp', 'openssl', 'bcmath', 'curl', 'mbstring'],
            'cles' => ['sujet', 'publique' => ['presente', 'longueur', 'espaces_en_bout'], 'privee'],
            'signature' => ['ok'],
            'verdict',
            'abonnements',
        ]);

        $this->assertIsBool($reponse->json('extensions.gmp'));
    }

    /**
     * Sur une paire valide, la signature doit aboutir — **avec ou sans `gmp`**.
     *
     * Vérifié le 19 août 2026 : un jeton VAPID de 323 caractères est produit
     * sans l'extension. `gmp` ne sert qu'à `createVapidKeys()`, c'est-à-dire à
     * la génération d'une paire, faite une fois pour toutes. J'avais d'abord
     * cru l'inverse et écrit que sans elle « aucun envoi ne part » : c'était
     * faux, et ce test empêche d'y revenir.
     */
    public function test_une_paire_valide_signe_meme_sans_gmp(): void
    {
        $paire = $this->pairePosee();

        if (! $paire) {
            $this->markTestSkipped('Aucune paire valide disponible dans cet environnement.');
        }

        $admin = User::factory()->admin()->create();
        $reponse = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/diagnostic/notifications');

        $this->assertTrue(
            $reponse->json('signature.ok'),
            'La signature doit aboutir. Verdict : '.$reponse->json('verdict')
        );
        $this->assertContains('Authorization', $reponse->json('signature.entetes'));
    }

    /** Une paire invalide doit être refusée, et le verdict désigner les clés. */
    public function test_une_paire_invalide_est_refusee_et_le_verdict_designe_les_cles(): void
    {
        config([
            'push.actif' => true,
            'push.vapid.sujet' => 'mailto:contact@mavilla.sn',
            // Longueur correcte, contenu absurde : la signature ne peut aboutir.
            'push.vapid.publique' => rtrim(strtr(base64_encode(chr(4).str_repeat(chr(1), 64)), '+/', '-_'), '='),
            'push.vapid.privee' => rtrim(strtr(base64_encode(str_repeat(chr(1), 32)), '+/', '-_'), '='),
        ]);

        $admin = User::factory()->admin()->create();
        $reponse = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/diagnostic/notifications');

        $reponse->assertOk()->assertJsonPath('signature.ok', false);
        $this->assertStringContainsString('VAPID', (string) $reponse->json('verdict'));
    }

    /** La clé privée ne doit jamais sortir, même tronquée. */
    public function test_la_cle_privee_n_est_jamais_divulguee(): void
    {
        $this->avecVraiesCles();
        $admin = User::factory()->admin()->create();

        $corps = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/diagnostic/notifications')->getContent();

        $this->assertStringNotContainsString(config('push.vapid.privee'), $corps);
        // Même son début ne doit pas apparaître.
        $this->assertStringNotContainsString(substr((string) config('push.vapid.privee'), 0, 8), $corps);
    }
}
