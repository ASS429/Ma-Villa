<?php

namespace Tests\Feature;

use App\Models\JournalAdmin;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * La modération d'une annonce, dans les deux sens.
 *
 * Le défaut signalé : une villa validée ne pouvait plus être retirée. L'API
 * l'acceptait, l'écran ne l'offrait pas — un trou d'interface, mais un trou qui
 * laissait en ligne une annonce frauduleuse ou dont le propriétaire demandait
 * le retrait.
 *
 * La règle qui l'accompagne : **un refus exige un motif**. C'est lui qui part
 * au propriétaire et au journal ; un rejet sans raison produit un appel au
 * service client et une annonce que personne ne corrige.
 */
class ModerationVillaTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
    }

    private function changer(Villa $villa, array $charge)
    {
        return $this->actingAs($this->admin, 'sanctum')
                    ->patchJson("/api/admin/villas/{$villa->id}/statut", $charge);
    }

    /* ── Le défaut signalé ───────────────────────────────────────── */

    public function test_une_villa_validee_peut_etre_retiree(): void
    {
        $villa = Villa::factory()->validee()->create();

        $this->changer($villa, ['statut' => 'rejetee', 'motif' => "Le propriétaire demande le retrait."])
             ->assertOk();

        $this->assertSame('rejetee', $villa->refresh()->statut);
    }

    /** Retirer une annonce en ligne n'est pas la même chose que refuser un dépôt. */
    public function test_le_retrait_est_distingue_du_rejet_dans_le_journal(): void
    {
        $enLigne = Villa::factory()->validee()->create();
        $enAttente = Villa::factory()->create(['statut' => 'en_attente']);

        $this->changer($enLigne, ['statut' => 'rejetee', 'motif' => 'Annonce frauduleuse constatée.']);
        $this->changer($enAttente, ['statut' => 'rejetee', 'motif' => 'Photos reprises ailleurs.']);

        $this->assertDatabaseHas('journal_admin', ['action' => 'villa.retiree']);
        $this->assertDatabaseHas('journal_admin', ['action' => 'villa.rejetee']);
    }

    /* ── L'autre sens ────────────────────────────────────────────── */

    public function test_une_villa_rejetee_peut_etre_revalidee(): void
    {
        $villa = Villa::factory()->create(['statut' => 'rejetee']);

        $this->changer($villa, ['statut' => 'validee'])->assertOk();

        $this->assertSame('validee', $villa->refresh()->statut);
    }

    /** Valider n'a pas à se justifier : seul le refus prive quelqu'un de quelque chose. */
    public function test_valider_ne_demande_aucun_motif(): void
    {
        $villa = Villa::factory()->create(['statut' => 'en_attente']);

        $this->changer($villa, ['statut' => 'validee'])->assertOk();
    }

    /* ── Le motif ────────────────────────────────────────────────── */

    public function test_un_refus_sans_motif_est_refuse(): void
    {
        $villa = Villa::factory()->validee()->create();

        $this->changer($villa, ['statut' => 'rejetee'])
             ->assertStatus(422)
             ->assertJsonValidationErrors('motif');

        $this->assertSame('validee', $villa->refresh()->statut, "L'annonce ne doit pas bouger.");
    }

    /** Un mot n'est pas un motif : il ne dit ni quoi corriger, ni pourquoi. */
    public function test_un_motif_trop_court_est_refuse(): void
    {
        $villa = Villa::factory()->validee()->create();

        $this->changer($villa, ['statut' => 'rejetee', 'motif' => 'non'])
             ->assertStatus(422)
             ->assertJsonValidationErrors('motif');
    }

    /** Le motif voyage jusqu'au journal : sans lui, la trace ne prouve rien. */
    public function test_le_motif_est_consigne(): void
    {
        $villa = Villa::factory()->validee()->create();

        $this->changer($villa, ['statut' => 'rejetee', 'motif' => 'Prix trois fois la médiane locale.']);

        $trace = JournalAdmin::where('action', 'villa.retiree')->first();

        $this->assertNotNull($trace);
        $this->assertSame('Prix trois fois la médiane locale.', $trace->details['motif']);
    }

    /* ── Accès ───────────────────────────────────────────────────── */

    public function test_un_proprietaire_ne_modere_pas(): void
    {
        $villa = Villa::factory()->validee()->create();
        $proprietaire = User::find($villa->user_id) ?? User::factory()->proprietaire()->create();

        $this->actingAs($proprietaire, 'sanctum')
             ->patchJson("/api/admin/villas/{$villa->id}/statut", [
                 'statut' => 'rejetee',
                 'motif'  => 'Je retire mon annonce moi-même.',
             ])
             ->assertStatus(403);

        $this->assertSame('validee', $villa->refresh()->statut);
    }

    /* ── Le propriétaire apprend la mise en ligne ────────────────── */

    /**
     * Il était prévenu d'un refus, jamais d'une validation : il envoyait son
     * annonce, puis n'apprenait plus rien.
     */
    public function test_la_mise_en_ligne_previent_le_proprietaire_par_e_mail(): void
    {
        \Illuminate\Support\Facades\Notification::fake();
        $villa = Villa::factory()->create(['statut' => 'en_attente']);
        $proprietaire = User::findOrFail($villa->user_id);

        $this->changer($villa, ['statut' => 'validee'])->assertOk();

        \Illuminate\Support\Facades\Notification::assertSentTo(
            $proprietaire,
            \App\Notifications\AnnonceEnLigne::class,
            fn ($notification, array $canaux) => $canaux === ['mail'] && $notification->villa->is($villa),
        );
    }

    /** Revalider une annonce déjà en ligne ne change rien pour lui. */
    public function test_revalider_une_annonce_en_ligne_ne_previent_pas(): void
    {
        \Illuminate\Support\Facades\Notification::fake();
        $villa = Villa::factory()->validee()->create();

        $this->changer($villa, ['statut' => 'validee'])->assertOk();

        \Illuminate\Support\Facades\Notification::assertNothingSent();
    }

    /** `passetemps.sn` n'a pas de boîte : les comptes d'import y ont une adresse d'attente. */
    public function test_une_adresse_sans_boite_ne_recoit_pas_d_e_mail(): void
    {
        \Illuminate\Support\Facades\Notification::fake();
        $proprietaire = User::factory()->proprietaire()->create(['email' => 'cle-dor@passetemps.sn']);
        $villa = Villa::factory()->create(['statut' => 'en_attente', 'user_id' => $proprietaire->id]);

        $this->changer($villa, ['statut' => 'validee'])->assertOk();

        \Illuminate\Support\Facades\Notification::assertNotSentTo($proprietaire, \App\Notifications\AnnonceEnLigne::class);
        $this->assertSame('validee', $villa->refresh()->statut);
    }

    /** Sans la barre oblique finale, Render sert le gabarit générique. */
    public function test_l_e_mail_mene_a_la_page_de_l_annonce(): void
    {
        $villa = Villa::factory()->validee()->create();
        $proprietaire = User::findOrFail($villa->user_id);

        $mail = (new \App\Notifications\AnnonceEnLigne($villa))->toMail($proprietaire);

        $this->assertStringEndsWith("/hebergements/{$villa->id}/", $mail->actionUrl);
        $this->assertStringContainsString($villa->nom, $mail->subject);
    }
}
