<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Paiement;
use App\Models\Reservation;
use App\Models\Reversement;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use App\Services\Commission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Le déboursement automatique vers Wave / Orange Money.
 *
 * Toutes les réponses PayDunya sont simulées : on ne teste pas leur API, on
 * teste **ce qu'on en fait** — et notamment les deux cas qui coûtent de
 * l'argent si on les traite mal, l'échec (qui doit rendre les paiements à la
 * file) et le doute (qui ne doit surtout pas les rendre).
 */
class DeboursementTest extends TestCase
{
    use RefreshDatabase;

    private User $proprietaire;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->proprietaire = User::factory()->proprietaire()->create(['phone' => '+221 77 123 45 67']);
        $this->admin = User::factory()->admin()->create();

        config([
            'paiement.reversement.automatique' => true,
            'paiement.paydunya.mode' => 'test',
            'paiement.paydunya.cle_maitre' => 'cle-maitresse-de-test',
            'paiement.paydunya.cle_privee' => 'test_private_abc',
            'paiement.paydunya.cle_publique' => 'test_public_abc',
            'paiement.paydunya.token' => 'jeton-de-test',
        ]);
    }

    private function sejourExigible(int $montant = 100000): Paiement
    {
        $villa = Villa::factory()->validee()->create(['user_id' => $this->proprietaire->id]);
        $logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'villa_entiere',
            'capacite' => 4, 'disponible' => true,
        ]);
        $tarif = Tarif::create([
            'logement_id' => $logement->id, 'type_tarif' => 'nuitee',
            'prix' => $montant, 'avec_clim' => false, 'avec_buffet' => false,
        ]);
        $reservation = Reservation::create([
            'user_id' => User::factory()->client()->create()->id,
            'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
            'date_debut' => now()->subDays(6)->toDateString(),
            'date_fin' => now()->subDays(2)->toDateString(),
            'nb_personnes' => 2, 'montant_total' => $montant, 'statut' => 'confirmee',
        ]);

        $paiement = new Paiement([
            'reservation_id' => $reservation->id, 'methode' => 'wave',
            'statut' => 'reussi', 'paye_le' => now(),
        ]);
        $paiement->appliquerRepartition(Commission::pour($montant));
        $paiement->save();

        return $paiement->refresh();
    }

    private function verser(array $charge = []): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/reversements', array_merge([
            'user_id' => $this->proprietaire->id,
            'methode' => 'wave',
            'mode'    => 'automatique',
        ], $charge));
    }

    /* ── Le chemin heureux ───────────────────────────────────────── */

    public function test_un_deboursement_abouti_solde_le_reversement(): void
    {
        $paiement = $this->sejourExigible();

        Http::fake([
            '*/disburse/get-invoice' => Http::response(['response_code' => '00', 'disburse_token' => 'JETON-1']),
            '*/disburse/submit-invoice' => Http::response([
                'response_code' => '00',
                'response_text' => 'Transaction completed successfully',
                'transaction_id' => 'TFA-TX-ABC',
                'provider_ref' => 'pt-999',
            ]),
        ]);

        $this->verser()->assertStatus(201);

        $reversement = Reversement::first();
        $this->assertSame('reussi', $reversement->statut);
        $this->assertSame('JETON-1', $reversement->disburse_token);
        $this->assertSame('TFA-TX-ABC', $reversement->transaction_id);
        $this->assertNotNull($reversement->verse_le);
        $this->assertSame($reversement->id, $paiement->refresh()->reversement_id);
    }

    /** Le numéro part sans indicatif ni espaces : c'est ce qu'attend l'API. */
    public function test_le_numero_est_normalise_avant_l_envoi(): void
    {
        $this->sejourExigible();

        Http::fake([
            '*/disburse/get-invoice' => Http::response(['response_code' => '00', 'disburse_token' => 'JETON-1']),
            '*/disburse/submit-invoice' => Http::response(['response_code' => '00']),
        ]);

        $this->verser();

        Http::assertSent(function ($requete) {
            if (! str_contains($requete->url(), 'get-invoice')) {
                return true;
            }

            return $requete['account_alias'] === '771234567'
                && $requete['amount'] === 85000
                && $requete['withdraw_mode'] === 'wave-senegal';
        });
    }

    /** Notre référence part avec la soumission : c'est elle qui interdit le doublon. */
    public function test_la_reference_interdit_le_rejeu(): void
    {
        $this->sejourExigible();

        Http::fake([
            '*/disburse/get-invoice' => Http::response(['response_code' => '00', 'disburse_token' => 'JETON-1']),
            '*/disburse/submit-invoice' => Http::response(['response_code' => '00']),
        ]);

        $this->verser();
        $reversement = Reversement::first();

        $this->assertSame("MV-REV-{$reversement->id}", $reversement->disburse_id);
        Http::assertSent(fn ($r) => ! str_contains($r->url(), 'submit-invoice')
            || $r['disburse_id'] === "MV-REV-{$reversement->id}");
    }

    /* ── L'échec ─────────────────────────────────────────────────── */

    /**
     * Le cas qui compte : un versement refusé doit **rendre les paiements à la
     * file**. Sans cela, le propriétaire attendrait un argent que plus rien ne
     * réclame — ni dans sa colonne « dû », ni dans la file de l'administrateur.
     */
    public function test_un_echec_rend_les_paiements_a_la_file(): void
    {
        $paiement = $this->sejourExigible();

        Http::fake([
            '*/disburse/get-invoice' => Http::response(['response_code' => '00', 'disburse_token' => 'JETON-1']),
            '*/disburse/submit-invoice' => Http::response(['response_code' => '00', 'status' => 'failed']),
            '*/disburse/check-status' => Http::response(['response_code' => '00', 'status' => 'failed']),
        ]);

        $this->verser()->assertStatus(502);

        $this->assertSame('echoue', Reversement::first()->statut);
        $this->assertNull($paiement->refresh()->reversement_id, 'Le paiement doit redevenir exigible.');

        $this->assertSame(
            85000.0,
            (float) $this->actingAs($this->proprietaire, 'sanctum')
                        ->getJson('/api/proprietaire/revenus')->json('du')
        );
    }

    /** Une initiation refusée ne doit rien laisser de rattaché non plus. */
    public function test_une_initiation_refusee_libere_les_paiements(): void
    {
        $paiement = $this->sejourExigible();

        Http::fake([
            '*/disburse/get-invoice' => Http::response([
                'response_code' => '401', 'response_text' => 'Initiation not authorize',
            ]),
        ]);

        $this->verser()->assertStatus(502);

        $reversement = Reversement::first();
        $this->assertSame('echoue', $reversement->statut);
        $this->assertStringContainsString('PER', $reversement->echec_motif);
        $this->assertNull($paiement->refresh()->reversement_id);
    }

    /**
     * Le cas symétrique, et le plus dangereux : quand on **ne sait pas**, les
     * paiements restent rattachés. Les libérer permettrait un second virement
     * pour un argent peut-être déjà parti.
     */
    public function test_un_statut_inconnu_ne_libere_rien(): void
    {
        $paiement = $this->sejourExigible();

        Http::fake([
            '*/disburse/get-invoice' => Http::response(['response_code' => '00', 'disburse_token' => 'JETON-1']),
            '*/disburse/submit-invoice' => Http::response(['response_code' => '5000'], 500),
            '*/disburse/check-status' => Http::response(['response_code' => '00', 'status' => 'pending']),
        ]);

        $this->verser()->assertStatus(201);

        $this->assertSame('en_cours', Reversement::first()->statut);
        $this->assertNotNull($paiement->refresh()->reversement_id, 'Un doute ne libère jamais les paiements.');
    }

    /* ── Les refus avant l'appel ─────────────────────────────────── */

    public function test_le_mode_automatique_est_refuse_quand_il_est_desactive(): void
    {
        config(['paiement.reversement.automatique' => false]);
        $this->sejourExigible();
        Http::fake();

        $this->verser()->assertStatus(422);

        Http::assertNothingSent();
        $this->assertSame(0, Reversement::count());
    }

    public function test_un_moyen_hors_ligne_ne_peut_pas_etre_debourse(): void
    {
        $this->sejourExigible();
        Http::fake();

        $this->verser(['methode' => 'especes'])->assertStatus(422);

        Http::assertNothingSent();
        $this->assertSame(0, Reversement::count());
    }

    public function test_un_proprietaire_sans_numero_est_refuse(): void
    {
        $this->proprietaire->update(['phone' => null]);
        $this->sejourExigible();
        Http::fake();

        $this->verser()->assertStatus(422);

        Http::assertNothingSent();
    }

    /* ── Le versement manuel reste intact ────────────────────────── */

    public function test_le_versement_manuel_n_appelle_pas_paydunya(): void
    {
        $this->sejourExigible();
        Http::fake();

        $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/reversements', [
            'user_id' => $this->proprietaire->id,
            'methode' => 'virement',
        ])->assertStatus(201);

        Http::assertNothingSent();
        $this->assertSame('manuel', Reversement::first()->statut);
        $this->assertNotNull(Reversement::first()->verse_le);
    }

    /* ── Le rappel ───────────────────────────────────────────────── */

    private function reversementEnCours(): Reversement
    {
        $paiement = $this->sejourExigible();

        Http::fake([
            '*/disburse/get-invoice' => Http::response(['response_code' => '00', 'disburse_token' => 'JETON-1']),
            '*/disburse/submit-invoice' => Http::response(['response_code' => '00', 'status' => 'pending']),
        ]);

        $this->verser();
        $paiement->refresh();

        return Reversement::first();
    }

    public function test_un_rappel_non_signe_est_ignore(): void
    {
        $reversement = $this->reversementEnCours();

        $this->postJson('/api/reversements/rappel', [
            'hash' => 'signature-inventee',
            'token' => 'JETON-1',
            'status' => 'success',
        ])->assertOk();

        $this->assertSame('en_cours', $reversement->refresh()->statut);
    }

    /**
     * Même signé, le corps du rappel n'est pas cru : le statut est relu chez
     * PayDunya. Un « success » annoncé sur une transaction réellement échouée
     * solderait une dette dont pas un franc n'est parti.
     */
    public function test_un_rappel_signe_fait_foi_apres_verification(): void
    {
        $reversement = $this->reversementEnCours();

        Http::fake([
            '*/disburse/check-status' => Http::response([
                'response_code' => '00', 'status' => 'failed',
            ]),
        ]);

        $this->postJson('/api/reversements/rappel', [
            'hash' => hash('sha512', 'cle-maitresse-de-test'),
            'token' => 'JETON-1',
            'status' => 'success',
        ])->assertOk();

        $this->assertSame(
            'echoue',
            $reversement->refresh()->statut,
            "C'est l'API qui tranche, jamais le corps du rappel."
        );
    }

    public function test_un_rappel_signe_confirme_un_versement(): void
    {
        $reversement = $this->reversementEnCours();

        Http::fake([
            '*/disburse/check-status' => Http::response([
                'response_code' => '00',
                'status' => 'success',
                'transaction_id' => 'TFA-TX-OK',
            ]),
        ]);

        $this->postJson('/api/reversements/rappel', [
            'hash' => hash('sha512', 'cle-maitresse-de-test'),
            'token' => 'JETON-1',
        ])->assertOk();

        $reversement->refresh();
        $this->assertSame('reussi', $reversement->statut);
        $this->assertSame('TFA-TX-OK', $reversement->transaction_id);
        $this->assertNotNull($reversement->verse_le);
    }

    /* ── Le rattrapage périodique ────────────────────────────────── */

    /**
     * Le rappel peut ne jamais arriver. Sans ce rattrapage, un versement
     * resterait « en cours » indéfiniment et son montant disparaîtrait des
     * deux consoles : c'est ainsi que de l'argent se perd de vue.
     */
    public function test_la_commande_tranche_un_versement_reste_en_cours(): void
    {
        $reversement = $this->reversementEnCours();

        // Par le constructeur de requetes : un `update()` Eloquent replacerait
        // `updated_at` a maintenant, et le versement resterait trop recent
        // pour que la commande le regarde.
        \Illuminate\Support\Facades\DB::table('reversements')
            ->where('id', $reversement->id)
            ->update(['updated_at' => now()->subHour()]);

        Http::fake([
            '*/disburse/check-status' => Http::response([
                'response_code' => '00', 'status' => 'success', 'transaction_id' => 'TFA-TX-TARD',
            ]),
        ]);

        $this->artisan('passetemps:suivre-reversements')->assertSuccessful();

        $this->assertSame('reussi', $reversement->refresh()->statut);
    }

    public function test_la_commande_ne_touche_pas_un_versement_tout_juste_soumis(): void
    {
        $reversement = $this->reversementEnCours();
        Http::fake();

        $this->artisan('passetemps:suivre-reversements')->assertSuccessful();

        Http::assertNothingSent();
        $this->assertSame('en_cours', $reversement->refresh()->statut);
    }

    /* ── La sonde ────────────────────────────────────────────────── */

    /** Elle initie, mais ne soumet jamais : aucun argent ne peut partir. */
    public function test_la_sonde_n_execute_aucun_versement(): void
    {
        Http::fake([
            '*/disburse/get-invoice' => Http::response(['response_code' => '00', 'disburse_token' => 'SONDE-1']),
        ]);

        $reponse = $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/diagnostic/reversement');

        $reponse->assertOk()->assertJsonPath('initiation.ok', true);
        Http::assertNotSent(fn ($r) => str_contains($r->url(), 'submit-invoice'));
    }

    public function test_la_sonde_nomme_l_option_a_faire_activer(): void
    {
        Http::fake([
            '*/disburse/get-invoice' => Http::response([
                'response_code' => '401', 'response_text' => 'Initiation not authorize',
            ]),
        ]);

        $reponse = $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/diagnostic/reversement');

        $reponse->assertOk()->assertJsonPath('initiation.ok', false);
        $this->assertStringContainsString('PER', $reponse->json('initiation.verdict'));
    }

    public function test_la_sonde_est_refusee_a_un_non_admin(): void
    {
        $this->actingAs($this->proprietaire, 'sanctum')
             ->getJson('/api/admin/diagnostic/reversement')
             ->assertStatus(403);
    }
}
