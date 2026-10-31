<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Les erreurs de formulaire sont en français, même sans `APP_LOCALE`.
 *
 * 31 octobre 2026 : la production n'avait pas la variable, et le code
 * prenait l'anglais par défaut. Le `.env` local disait `fr` : rien ne le
 * montrait, ni en local ni dans les tests.
 */
class LangueDesErreursTest extends TestCase
{
    public function test_le_francais_est_la_langue_livree_par_defaut(): void
    {
        $this->assertStringContainsString(
            "env('APP_LOCALE', 'fr')",
            file_get_contents(config_path('app.php')),
        );
    }

    public function test_une_erreur_de_saisie_repond_en_francais(): void
    {
        app()->setLocale('fr');

        $this->postJson('/api/auth/register', ['name' => str_repeat('a', 300)])
            ->assertStatus(422)
            ->assertJsonPath('errors.name.0', 'Le champ nom ne peut contenir plus de 255 caractères.');
    }
}
