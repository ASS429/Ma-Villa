<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\PreferencesNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * La grille des notifications.
 *
 * Un test porte tout le reste : **un canal verrouillé reste actif quoi qu'on
 * écrive**. Rater une demande de réservation annule le séjour au bout de 24 h —
 * ce n'est pas une préférence, c'est le fonctionnement du produit.
 */
class PreferencesNotificationTest extends TestCase
{
    use RefreshDatabase;

    private User $proprietaire;

    protected function setUp(): void
    {
        parent::setUp();
        $this->proprietaire = User::factory()->proprietaire()->create();
    }

    /* ── Le barème par défaut ────────────────────────────────────── */

    public function test_un_compte_neuf_suit_le_bareme(): void
    {
        $reponse = $this->actingAs($this->proprietaire, 'sanctum')
                        ->getJson('/api/notifications/preferences');

        $reponse->assertOk();
        $this->assertCount(5, $reponse->json('sujets'));
        $this->assertSame(['appli', 'sms', 'mail'], array_keys($reponse->json('canaux')));
    }

    /**
     * Rien n'est écrit en base à l'inscription : un défaut modifié s'applique
     * à tout le monde, pas aux seuls nouveaux venus.
     */
    public function test_rien_n_est_ecrit_en_base_avant_un_choix(): void
    {
        $this->actingAs($this->proprietaire, 'sanctum')->getJson('/api/notifications/preferences');

        $this->assertNull($this->proprietaire->fresh()->preferences_notification);
    }

    /** Sur un forfait payé au volume, un SMS marketing non demandé coûte de l'argent. */
    public function test_les_conseils_sont_decoches_partout_par_defaut(): void
    {
        $sujets = $this->actingAs($this->proprietaire, 'sanctum')
                       ->getJson('/api/notifications/preferences')->json('sujets');

        $conseils = collect($sujets)->firstWhere('cle', 'conseils');

        $this->assertFalse($conseils['canaux']['sms']['actif']);
        $this->assertFalse($conseils['canaux']['mail']['actif']);
        $this->assertFalse($conseils['canaux']['appli']['actif']);
    }

    /* ── Les verrous ─────────────────────────────────────────────── */

    /**
     * **Le test qui porte tout le reste.** Un compte qui envoie « appli:
     * false » sur une demande de réservation doit continuer de la recevoir.
     */
    public function test_un_canal_verrouille_reste_actif_quoi_qu_on_envoie(): void
    {
        $this->actingAs($this->proprietaire, 'sanctum')
             ->putJson('/api/notifications/preferences', [
                 'preferences' => [
                     'reservation_demande' => ['appli' => false, 'sms' => false, 'mail' => false],
                     'versements'          => ['appli' => false],
                 ],
             ])
             ->assertOk();

        $sujets = collect(
            $this->actingAs($this->proprietaire, 'sanctum')
                 ->getJson('/api/notifications/preferences')->json('sujets')
        )->keyBy('cle');

        $this->assertTrue($sujets['reservation_demande']['canaux']['appli']['actif']);
        $this->assertTrue($sujets['reservation_demande']['canaux']['appli']['verrouille']);
        $this->assertTrue($sujets['versements']['canaux']['appli']['actif']);

        // Mais les canaux libres du même sujet, eux, ont bien été coupés.
        $this->assertFalse($sujets['reservation_demande']['canaux']['sms']['actif']);
    }

    /**
     * Le verrou n'est pas non plus enregistré : il est réappliqué à la
     * lecture. Écrire « true » en base le rendrait contournable en modifiant
     * la base à la main.
     */
    public function test_le_verrou_n_est_pas_enregistre_mais_reapplique(): void
    {
        $this->actingAs($this->proprietaire, 'sanctum')
             ->putJson('/api/notifications/preferences', [
                 'preferences' => ['reservation_demande' => ['appli' => false, 'sms' => false]],
             ]);

        $enBase = $this->proprietaire->fresh()->preferences_notification;

        $this->assertArrayNotHasKey('appli', $enBase['reservation_demande']);
        $this->assertFalse($enBase['reservation_demande']['sms']);
    }

    /** Chaque verrou porte sa raison, écrite : une case grisée sans motif se subit. */
    public function test_chaque_verrou_porte_sa_raison(): void
    {
        $sujets = collect(
            $this->actingAs($this->proprietaire, 'sanctum')
                 ->getJson('/api/notifications/preferences')->json('sujets')
        );

        foreach ($sujets as $sujet) {
            $verrouille = collect($sujet['canaux'])->contains(fn ($c) => $c['verrouille']);

            if ($verrouille) {
                $this->assertNotEmpty($sujet['raison'], "Le sujet « {$sujet['nom']} » verrouille sans dire pourquoi.");
            }
        }
    }

    /* ── L'assainissement ────────────────────────────────────────── */

    public function test_un_sujet_ou_un_canal_inconnu_est_ignore(): void
    {
        $this->actingAs($this->proprietaire, 'sanctum')
             ->putJson('/api/notifications/preferences', [
                 'preferences' => [
                     'pigeon_voyageur' => ['appli' => true],
                     'messages'        => ['fax' => true, 'sms' => true],
                 ],
             ])
             ->assertOk();

        $enBase = $this->proprietaire->fresh()->preferences_notification;

        $this->assertArrayNotHasKey('pigeon_voyageur', $enBase);
        $this->assertArrayNotHasKey('fax', $enBase['messages']);
        $this->assertTrue($enBase['messages']['sms']);
    }

    /* ── Ce que le code d'envoi doit appeler ─────────────────────── */

    public function test_accepte_repond_pour_le_code_d_envoi(): void
    {
        $this->assertTrue(PreferencesNotification::accepte($this->proprietaire, 'reservation_demande', 'appli'));
        $this->assertFalse(PreferencesNotification::accepte($this->proprietaire, 'conseils', 'sms'));

        $this->proprietaire->preferences_notification = ['messages' => ['sms' => true]];
        $this->proprietaire->save();

        $this->assertTrue(PreferencesNotification::accepte($this->proprietaire->fresh(), 'messages', 'sms'));
    }

    /** Un sujet inconnu ne part pas : mieux vaut une notification manquante qu'incoupable. */
    public function test_un_sujet_inconnu_n_est_jamais_envoye(): void
    {
        $this->assertFalse(PreferencesNotification::accepte($this->proprietaire, 'inconnu', 'appli'));
    }

    public function test_un_visiteur_ne_lit_aucune_preference(): void
    {
        $this->getJson('/api/notifications/preferences')->assertStatus(401);
    }
}
