<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Un transport email mal configuré est une erreur d'exploitation fréquente
 * (une adresse dans MAIL_MAILER, une clé d'API expirée, un service injoignable).
 * Elle ne doit jamais interrompre une action métier.
 */
class MailCasseTest extends TestCase
{
    use RefreshDatabase;

    private function transportInvalide(): void
    {
        config(['mail.default' => 'sanarfang429@gmail.com', 'queue.default' => 'sync']);
    }

    public function test_inscription_aboutit_malgre_un_transport_email_casse(): void
    {
        $this->transportInvalide();

        $this->postJson('/api/auth/register', [
            'name' => 'Awa Diop',
            'email' => 'awa@exemple.sn',
            'password' => 'mot-de-passe-solide',
            'password_confirmation' => 'mot-de-passe-solide',
            'role' => 'client',
        ])->assertStatus(201);

        $this->assertDatabaseHas('users', ['email' => 'awa@exemple.sn']);
    }

    public function test_mot_de_passe_oublie_ne_revele_pas_la_panne(): void
    {
        User::factory()->client()->create(['email' => 'client@exemple.sn']);
        $this->transportInvalide();

        // Même réponse qu'en fonctionnement normal : ni 500, ni indice sur
        // l'existence du compte.
        $this->postJson('/api/auth/forgot-password', ['email' => 'client@exemple.sn'])
             ->assertOk()
             ->assertJsonPath('message', 'Si un compte existe avec cette adresse, un lien de réinitialisation vient d\'être envoyé.');
    }

    public function test_une_reservation_aboutit_malgre_un_transport_email_casse(): void
    {
        $this->transportInvalide();

        $proprietaire = User::factory()->proprietaire()->create();
        $villa = \App\Models\Villa::factory()->validee()->create(['user_id' => $proprietaire->id]);
        $logement = $villa->logements()->create([
            'nom' => 'Suite', 'type' => 'villa_entiere', 'capacite' => 6, 'disponible' => true,
        ]);
        $tarif = $logement->tarifs()->create(['type_tarif' => 'nuitee', 'prix' => 100000]);

        $this->actingAs(User::factory()->client()->create(), 'sanctum')
             ->postJson('/api/reservations', [
                 'logement_id' => $logement->id,
                 'tarif_id' => $tarif->id,
                 'date_debut' => now()->addDays(5)->toDateString(),
                 'date_fin' => now()->addDays(8)->toDateString(),
                 'nb_personnes' => 2,
             ])->assertStatus(201);
    }

    public function test_le_diagnostic_signale_un_transport_invalide(): void
    {
        $this->transportInvalide();

        $this->artisan('passetemps:diagnostic')
             ->expectsOutputToContain("n'est pas un transport valide")
             ->assertFailed();
    }
}
