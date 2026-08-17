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

    /**
     * Jeu de réponses PayDunya : création de facture, softpay, et surtout
     * `checkout-invoice/confirm`, qui est désormais la seule chose capable de
     * confirmer une réservation.
     *
     * @return array<string, mixed>
     */
    private function reponsesPayDunya(string $confirmation = 'pending', int $montant = 200000): array
    {
        return [
            '*checkout-invoice/create' => Http::response([
                'response_code' => '00', 'response_text' => 'https://paydunya/x', 'token' => 'JETON123',
            ]),
            '*softpay/wave-senegal' => Http::response([
                'success' => true, 'url' => 'https://pay.wave.com/c/abc',
            ]),
            '*checkout-invoice/confirm/*' => Http::response([
                'response_code' => '00',
                'status'        => $confirmation,
                'invoice'       => ['token' => 'JETON123', 'total_amount' => $montant],
            ]),
        ];
    }

    private function paiementEnAttente(Reservation $reservation, int $montant = 200000): Paiement
    {
        return Paiement::create([
            'reservation_id' => $reservation->id, 'methode' => 'wave',
            'montant' => $montant, 'reference' => 'MV-TEST',
            'token_paydunya' => 'JETON123', 'statut' => 'en_attente',
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

    public function test_orange_money_expose_et_conserve_ses_deux_liens(): void
    {
        // Orange Money ne met pas son URL au premier niveau : les liens vivent
        // dans `other_url`. Ne lire que `url` laissait l'écran sans rien à
        // afficher — ni bouton à toucher, ni code à scanner.
        Http::fake([
            '*checkout-invoice/create' => Http::response(['response_code' => '00', 'response_text' => 'u', 'token' => 'T']),
            '*softpay/new-orange-money-senegal' => Http::response([
                'success'   => true,
                'other_url' => [
                    'om_url'    => 'https://orangemoneysn.page.link/abc',
                    'maxit_url' => 'https://sugu.orange-sonatel.com/mp/abc',
                ],
            ]),
        ]);

        $reservation = $this->reservation();
        $reponse = $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'orange_money', 'telephone' => '770000000',
            ])->assertOk();

        // Maxit d'abord : « page.link » est un domaine Firebase Dynamic Links,
        // éteint par Google en août 2025. Ces liens ne résolvent plus.
        $this->assertEquals('https://sugu.orange-sonatel.com/mp/abc', $reponse->json('url_application'));
        $this->assertEquals('https://sugu.orange-sonatel.com/mp/abc', $reponse->json('url'));
        $this->assertEquals('https://orangemoneysn.page.link/abc', $reponse->json('url_om'));

        // Et surtout : ils survivent au rechargement de l'écran d'attente.
        $paiement = $reservation->fresh()->paiement;
        $this->assertEquals('https://sugu.orange-sonatel.com/mp/abc', $paiement->url_application);
        $this->assertEquals('https://sugu.orange-sonatel.com/mp/abc', $paiement->url_paiement);
    }

    public function test_le_code_qr_encode_un_lien_qui_ouvre_l_application(): void
    {
        // Encoder la page à QR code du prestataire dans notre propre QR ferait
        // scanner un écran pour en afficher un autre. C'est le lien qui ouvre
        // l'application qu'il faut y mettre.
        Http::fake([
            '*checkout-invoice/create' => Http::response(['response_code' => '00', 'response_text' => 'u', 'token' => 'T']),
            '*softpay/new-orange-money-senegal' => Http::response([
                'success'   => true,
                'url'       => 'https://app.paydunya.com/recharge-orange-sn?data=xxx',
                'other_url' => ['maxit_url' => 'https://sugu.orange-sonatel.com/mp/abc'],
            ]),
        ]);

        $reservation = $this->reservation();
        $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'orange_money', 'telephone' => '770000000',
            ])->assertOk()
            ->assertJsonPath('url', 'https://sugu.orange-sonatel.com/mp/abc')
            ->assertJsonPath('url_page', 'https://app.paydunya.com/recharge-orange-sn?data=xxx');
    }

    public function test_des_cles_reelles_ne_laissent_jamais_fuiter_la_cause(): void
    {
        // Le mode est déclaratif, donc en retard : brancher des clés de
        // production en oubliant PAYDUNYA_MODE exposerait le message du
        // prestataire à de vrais clients. Les clés ne peuvent pas mentir.
        config([
            'paiement.paydunya.mode'       => 'test',
            'paiement.paydunya.cle_privee' => 'live_private_reelle',
            'paiement.repli_checkout'      => false,
        ]);
        Http::fake(['*' => Http::response(['response_code' => '1001', 'response_text' => 'Invalid Masterkey'], 200)]);

        $reservation = $this->reservation();
        $reponse = $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ])->assertStatus(502);

        $this->assertNull($reponse->json('raison'));
    }

    public function test_un_paiement_sans_aucun_lien_est_refuse(): void
    {
        // Mieux vaut le dire que d'afficher un écran d'attente devant lequel il
        // n'y a rien à faire. Repli désactivé : c'est lui qu'on écarte ici.
        config([
            'paiement.repli_checkout' => false,
            'paiement.paydunya.cle_privee' => 'test_private_IHEGXFz',
        ]);
        Http::fake([
            '*checkout-invoice/create' => Http::response(['response_code' => '00', 'response_text' => 'u', 'token' => 'T']),
            '*softpay/wave-senegal' => Http::response(['success' => true]),
        ]);

        $reservation = $this->reservation();
        $reponse = $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ])->assertStatus(502);

        $this->assertStringContainsString('sans renvoyer de lien', $reponse->json('raison'));
    }

    /* ── Sonde d'administration ─────────────────────────────── */

    public function test_un_admin_sonde_la_configuration_de_paiement(): void
    {
        // Clés de production en place, la cause d'un refus n'est plus montrée
        // au payeur : sans cette sonde, il ne reste que les journaux.
        Http::fake(['*checkout-invoice/create' => Http::response([
            'response_code' => '00', 'response_text' => 'https://paydunya/x', 'token' => 'SONDE',
        ])]);

        $this->actingAs(User::factory()->admin()->create(), 'sanctum')
            ->getJson('/api/admin/diagnostic/paiement')
            ->assertOk()
            ->assertJsonPath('facture.ok', true)
            ->assertJsonPath('facture.jeton', 'SONDE')
            ->assertJsonPath('paiement_actif', true);
    }

    public function test_la_sonde_ne_divulgue_jamais_les_cles(): void
    {
        config(['paiement.paydunya.cle_maitre' => 'cle-maitresse-tres-secrete ']);
        Http::fake(['*' => Http::response(['response_code' => '00', 'response_text' => 'u', 'token' => 'T'])]);

        $reponse = $this->actingAs(User::factory()->admin()->create(), 'sanctum')
            ->getJson('/api/admin/diagnostic/paiement')
            ->assertOk();

        $reponse->assertDontSee('cle-maitresse-tres-secrete');
        // Mais elle signale l'espace au bout, panne courante et invisible.
        $this->assertTrue($reponse->json('cles.maitre.espaces_au_bout'));
    }

    public function test_la_sonde_ne_declenche_softpay_que_sur_demande(): void
    {
        // Un appel SoftPay envoie une demande de paiement sur un téléphone :
        // rien ne doit partir par surprise en ouvrant une page de diagnostic.
        Http::fake($this->reponsesPayDunya());

        $this->actingAs(User::factory()->admin()->create(), 'sanctum')
            ->getJson('/api/admin/diagnostic/paiement')
            ->assertOk()
            ->assertJsonPath('softpay.essaye', false);

        Http::assertNotSent(fn ($r) => str_contains($r->url(), 'softpay'));
    }

    public function test_la_sonde_teste_softpay_quand_un_numero_est_donne(): void
    {
        Http::fake($this->reponsesPayDunya());

        $this->actingAs(User::factory()->admin()->create(), 'sanctum')
            ->getJson('/api/admin/diagnostic/paiement?telephone=770000000&methode=wave')
            ->assertOk()
            ->assertJsonPath('softpay.ok', true)
            ->assertJsonPath('softpay.url', 'https://pay.wave.com/c/abc');
    }

    public function test_la_sonde_est_refusee_a_un_client(): void
    {
        $this->actingAs(User::factory()->client()->create(), 'sanctum')
            ->getJson('/api/admin/diagnostic/paiement')
            ->assertForbidden();
    }

    /* ── Repli sur la page du prestataire ───────────────────── */

    public function test_un_softpay_muet_replie_sur_la_page_de_paiement(): void
    {
        // SoftPay demande une activation côté PayDunya : tant qu'elle n'est pas
        // faite, l'appel répond sans rien. La facture, elle, reste payable.
        // Renoncer coûterait la vente ; se replier coûte une étape.
        Http::fake([
            '*checkout-invoice/create' => Http::response([
                'response_code' => '00',
                'response_text' => 'https://paydunya.com/checkout/invoice/T',
                'token' => 'T',
            ]),
            '*softpay/wave-senegal' => Http::response([], 404),
        ]);

        $reservation = $this->reservation();
        $reponse = $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ])->assertOk();

        $this->assertTrue($reponse->json('repli'));
        $this->assertEquals('https://paydunya.com/checkout/invoice/T', $reponse->json('url'));

        // Le paiement reste suivi normalement : c'est la même facture.
        $paiement = $reservation->fresh()->paiement;
        $this->assertEquals('en_attente', $paiement->statut);
        $this->assertEquals('T', $paiement->token_paydunya);
        $this->assertEquals('https://paydunya.com/checkout/invoice/T', $paiement->url_paiement);
    }

    public function test_le_repli_peut_etre_refuse(): void
    {
        // Qui préfère l'échec au parcours dégradé doit pouvoir le choisir.
        config([
            'paiement.repli_checkout' => false,
            'paiement.paydunya.cle_privee' => 'test_private_IHEGXFz',
        ]);
        Http::fake([
            '*checkout-invoice/create' => Http::response([
                'response_code' => '00', 'response_text' => 'https://paydunya.com/checkout/invoice/T', 'token' => 'T',
            ]),
            '*softpay/wave-senegal' => Http::response([], 404),
        ]);

        $reservation = $this->reservation();
        $reponse = $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ])->assertStatus(502);

        // Et la cause nomme le statut HTTP : « [] » ne disait pas si c'était un
        // 404, un 403 ou un 200 vide, qui se corrigent à trois endroits.
        $this->assertStringContainsString('HTTP 404', $reponse->json('raison'));
    }

    public function test_une_url_logee_ailleurs_est_quand_meme_trouvee(): void
    {
        // PayDunya ne loge pas l'URL au même endroit selon le moyen et la
        // version de l'API.
        Http::fake([
            '*checkout-invoice/create' => Http::response(['response_code' => '00', 'response_text' => 'u', 'token' => 'T']),
            '*softpay/wave-senegal' => Http::response([
                'success' => true, 'redirect_url' => 'https://pay.wave.com/c/secours',
            ]),
        ]);

        $reservation = $this->reservation();
        $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ])->assertOk()
            ->assertJsonPath('url', 'https://pay.wave.com/c/secours');
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

    public function test_des_cles_de_test_visent_le_bac_a_sable_et_evitent_softpay(): void
    {
        // La base réelle répond « LIVE Private Key and Token combination is
        // invalid » à des clés de test ; le bac à sable les accepte mais ne
        // sert pas SoftPay. Les deux ensemble : en test, la page de paiement
        // est le parcours normal, pas un incident.
        config([
            'paiement.paydunya.mode' => 'test',
            'paiement.paydunya.cle_privee' => 'test_private_IHEGXFz',
        ]);
        Http::fake([
            '*checkout-invoice/create' => Http::response([
                'response_code' => '00',
                'response_text' => 'https://paydunya.com/sandbox-checkout/invoice/T',
                'token' => 'T',
            ]),
        ]);

        $reservation = $this->reservation();
        $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ])->assertOk()
            ->assertJsonPath('repli', true)
            ->assertJsonPath('url', 'https://paydunya.com/sandbox-checkout/invoice/T');

        Http::assertSent(fn ($r) => str_contains($r->url(), '/sandbox-api/v1/'));
        // Pas d'appel SoftPay : ce serait une 404 certaine.
        Http::assertNotSent(fn ($r) => str_contains($r->url(), 'softpay'));
    }

    public function test_des_cles_reelles_visent_l_api_reelle_et_utilisent_softpay(): void
    {
        Http::fake($this->reponsesPayDunya());

        $reservation = $this->reservation();
        $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ])->assertOk()
            ->assertJsonPath('repli', false);

        Http::assertNotSent(fn ($r) => str_contains($r->url(), 'sandbox'));
        Http::assertSent(fn ($r) => str_contains($r->url(), '/api/v1/softpay/wave-senegal'));
    }

    public function test_la_base_reste_reglable_sans_redeploiement(): void
    {
        config(['paiement.paydunya.base_url' => 'https://exemple.test/api/v9']);
        Http::fake(['*' => Http::response(['response_code' => '00', 'response_text' => 'u', 'token' => 'T'])]);

        $reservation = $this->reservation();
        $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ]);

        Http::assertSent(fn ($r) => str_starts_with($r->url(), 'https://exemple.test/api/v9/'));
    }

    public function test_le_payeur_revient_sur_son_ecran_d_attente(): void
    {
        // Une page générique le laisserait ignorer si son paiement a été pris
        // en compte : seul son propre tunnel interroge le serveur.
        config(['app.frontend_url' => 'https://mavilla.test']);
        Http::fake([
            '*checkout-invoice/create' => Http::response(['response_code' => '00', 'response_text' => 'u', 'token' => 'T']),
            '*softpay/wave-senegal' => Http::response(['success' => true, 'url' => 'https://pay.wave.com/c/a']),
        ]);

        $reservation = $this->reservation();
        $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ])->assertOk();

        Http::assertSent(fn ($r) => ! str_contains($r->url(), 'checkout-invoice')
            || $r['actions']['return_url'] === "https://mavilla.test/reservation/{$reservation->id}/paiement");
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

    public function test_un_refus_en_mode_test_dit_pourquoi(): void
    {
        // Sans cette raison, un échec n'est lisible que dans les journaux du
        // serveur : celui qui teste voit « réessayez » et n'a rien sur quoi agir.
        config(['paiement.paydunya.cle_privee' => 'test_private_IHEGXFz']);
        Http::fake(['*' => Http::response([
            'response_code' => '1001', 'response_text' => 'Invalid Masterkey Specified',
        ], 200)]);

        $reservation = $this->reservation();
        $reponse = $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ])->assertStatus(502);

        $this->assertStringContainsString('Invalid Masterkey Specified', $reponse->json('raison'));
        $this->assertStringContainsString('1001', $reponse->json('raison'));
    }

    public function test_un_refus_en_encaissement_reel_ne_dit_rien_de_technique(): void
    {
        // Le message du prestataire peut nommer nos clés ou notre boutique : il
        // n'a rien à faire dans le navigateur d'un client qui paie vraiment.
        config([
            'paiement.paydunya.mode' => 'live',
            'paiement.paydunya.cle_privee' => 'live_private_reelle',
        ]);
        Http::fake(['*' => Http::response([
            'response_code' => '1001', 'response_text' => 'Invalid Masterkey Specified',
        ], 200)]);

        $reservation = $this->reservation();
        $reponse = $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ])->assertStatus(502);

        $this->assertNull($reponse->json('raison'));
        $reponse->assertDontSee('Masterkey');
    }

    public function test_le_mode_live_sur_des_cles_de_test_est_dit_franchement(): void
    {
        // Router en douce vers le bac à sable serait pire : on croirait
        // encaisser sans qu'aucun franc n'arrive. Et taire la cause laisserait
        // muet exactement le réglage qu'il faut corriger.
        config([
            'paiement.paydunya.mode' => 'live',
            'paiement.paydunya.cle_privee' => 'test_private_IHEGXFz',
        ]);
        Http::fake();

        $reservation = $this->reservation();
        $reponse = $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ])->assertStatus(502);

        $this->assertStringContainsString('PAYDUNYA_MODE', $reponse->json('raison'));
        Http::assertNothingSent();
    }

    public function test_une_cle_avec_un_espace_au_bout_reste_utilisable(): void
    {
        // Les clés sont recopiées à la main dans un tableau de bord : un retour
        // à la ligne au bout suffisait à faire refuser toutes les IPN.
        config(['paiement.paydunya.cle_maitre' => self::CLE_MAITRE."\n"]);
        Http::fake($this->reponsesPayDunya('completed'));

        $reservation = $this->reservation();
        $this->actingAs($reservation->client, 'sanctum')
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '770000000',
            ])->assertOk();

        Http::assertSent(fn ($r) => $r->header('PAYDUNYA-MASTER-KEY')[0] === self::CLE_MAITRE);

        // Et la signature de l'IPN reste reconnue.
        $this->postJson('/api/paiements/ipn', $this->ipn('JETON123', 'completed'))->assertOk();
        $this->assertEquals('confirmee', $reservation->fresh()->statut);
    }

    /* ── IPN — le point sensible ────────────────────────────── */

    public function test_une_notification_sans_signature_valide_est_rejetee(): void
    {
        // Sans ce rempart, n'importe qui s'offrirait une réservation en
        // annonçant « paiement réussi » sur une URL publique.
        Http::fake($this->reponsesPayDunya('completed'));
        $reservation = $this->reservation();
        $paiement = $this->paiementEnAttente($reservation);

        $this->postJson('/api/paiements/ipn', $this->ipn('JETON123', 'completed', 'hash-bidon'))
             ->assertForbidden();

        $this->assertEquals('en_attente', $paiement->fresh()->statut);
        $this->assertEquals('en_attente', $reservation->fresh()->statut);
        Http::assertNothingSent();
    }

    public function test_une_notification_authentique_confirme_la_reservation(): void
    {
        Http::fake($this->reponsesPayDunya('completed'));
        $reservation = $this->reservation();
        $this->paiementEnAttente($reservation);

        $this->postJson('/api/paiements/ipn', $this->ipn('JETON123', 'completed'))->assertOk();

        $this->assertEquals('reussi', $reservation->fresh()->paiement->statut);
        $this->assertEquals('confirmee', $reservation->fresh()->statut);
        $this->assertNotNull($reservation->fresh()->paiement->paye_le);
    }

    public function test_une_notification_qui_ment_ne_confirme_rien(): void
    {
        // Le cœur du dispositif : la signature est un secret partagé constant,
        // qui n'a besoin de fuiter qu'une fois. Le corps annonce « completed »,
        // PayDunya dit « pending » — c'est PayDunya qui tranche.
        Http::fake($this->reponsesPayDunya('pending'));
        $reservation = $this->reservation();
        $this->paiementEnAttente($reservation);

        $this->postJson('/api/paiements/ipn', $this->ipn('JETON123', 'completed'))->assertOk();

        $this->assertEquals('en_attente', $reservation->fresh()->paiement->statut);
        $this->assertEquals('en_attente', $reservation->fresh()->statut);
    }

    public function test_un_montant_encaisse_different_ne_confirme_rien(): void
    {
        // Facture qui n'est pas la nôtre, ou barème changé en cours de route :
        // dans les deux cas, il n'y a rien à confirmer.
        Http::fake($this->reponsesPayDunya('completed', montant: 500));
        $reservation = $this->reservation();
        $this->paiementEnAttente($reservation, 200000);

        $this->postJson('/api/paiements/ipn', $this->ipn('JETON123', 'completed'))->assertOk();

        $this->assertEquals('en_attente', $reservation->fresh()->paiement->statut);
        $this->assertEquals('en_attente', $reservation->fresh()->statut);
    }

    public function test_une_notification_repetee_ne_confirme_pas_deux_fois(): void
    {
        // PayDunya peut renvoyer la même notification : le traitement doit
        // être idempotent.
        Http::fake($this->reponsesPayDunya('completed'));
        $reservation = $this->reservation();
        $this->paiementEnAttente($reservation);

        $this->postJson('/api/paiements/ipn', $this->ipn('JETON123', 'completed'))->assertOk();
        $paye = $reservation->fresh()->paiement->paye_le;

        $this->postJson('/api/paiements/ipn', $this->ipn('JETON123', 'completed'))->assertOk();

        $this->assertEquals($paye, $reservation->fresh()->paiement->paye_le);
        $this->assertDatabaseCount('paiements', 1);
    }

    public function test_un_paiement_echoue_ne_confirme_rien(): void
    {
        Http::fake($this->reponsesPayDunya('cancelled'));
        $reservation = $this->reservation();
        $this->paiementEnAttente($reservation);

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

    /* ── L'écran d'attente n'attend pas l'IPN ───────────────── */

    public function test_l_ecran_d_attente_confirme_sans_aucune_notification(): void
    {
        // En bac à sable l'IPN n'arrive jamais, et en production elle se perd.
        // Sans interrogation active, « Confirmez sur votre téléphone » tourne
        // indéfiniment sur un paiement pourtant abouti.
        Http::fake($this->reponsesPayDunya('completed'));
        $reservation = $this->reservation();
        $this->paiementEnAttente($reservation);

        $this->actingAs($reservation->client, 'sanctum')
            ->getJson("/api/reservations/{$reservation->id}/paiement")
            ->assertOk()
            ->assertJsonPath('statut', 'reussi')
            ->assertJsonPath('reservation_statut', 'confirmee');

        $this->assertEquals('confirmee', $reservation->fresh()->statut);
    }

    public function test_un_prestataire_injoignable_laisse_le_paiement_en_cours(): void
    {
        // Ne rien savoir doit rester distinct de « refusé » : une coupure
        // réseau ne doit pas annuler un paiement en cours.
        Http::fake(['*' => Http::response(null, 500)]);
        $reservation = $this->reservation();
        $this->paiementEnAttente($reservation);

        $this->actingAs($reservation->client, 'sanctum')
            ->getJson("/api/reservations/{$reservation->id}/paiement")
            ->assertOk()
            ->assertJsonPath('statut', 'en_attente');

        $this->assertEquals('en_attente', $reservation->fresh()->statut);
    }

    public function test_un_tiers_ne_peut_pas_interroger_le_paiement_d_un_autre(): void
    {
        Http::fake($this->reponsesPayDunya('completed'));
        $reservation = $this->reservation();
        $this->paiementEnAttente($reservation);

        $this->actingAs(User::factory()->client()->create(), 'sanctum')
            ->getJson("/api/reservations/{$reservation->id}/paiement")
            ->assertForbidden();

        $this->assertEquals('en_attente', $reservation->fresh()->statut);
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
