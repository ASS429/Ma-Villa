<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Le dernier compte de démonstration portait une adresse sur @mavilla.sn, un
 * domaine libre : qui l'achète reçoit le lien « mot de passe oublié ». Ces tests
 * fixent qu'il ne s'ouvre plus par aucun chemin, et que rien de ce qui lui est
 * rattaché ne disparaît.
 */
class CompteDemonstrationNeutraliseTest extends TestCase
{
    use RefreshDatabase;

    private function neutraliser(): void
    {
        (require database_path('migrations/2026_11_02_000001_neutralise_le_compte_d_amadou_diallo.php'))->up();
    }

    private function compte(): User
    {
        return User::factory()->create([
            'email'    => 'amadou.diallo@mavilla.sn',
            'name'     => 'Amadou Diallo',
            'role'     => 'proprietaire',
            'password' => Hash::make('password'),
        ]);
    }

    public function test_l_ancienne_adresse_et_l_ancien_mot_de_passe_n_ouvrent_plus_rien(): void
    {
        $amadou = $this->compte();

        $this->neutraliser();

        $this->postJson('/api/auth/login', [
            'identifiant' => 'amadou.diallo@mavilla.sn',
            'password'    => 'password',
        ])->assertStatus(422);

        $this->postJson('/api/auth/login', [
            'identifiant' => $amadou->fresh()->email,
            'password'    => 'password',
        ])->assertStatus(422);

        $this->assertStringEndsWith('@passetemps.sn', $amadou->fresh()->email);
        $this->assertSame('Amadou Diallo (démonstration)', $amadou->fresh()->name);
    }

    public function test_ses_sessions_et_ses_demandes_de_mot_de_passe_sont_fermees(): void
    {
        $amadou = $this->compte();
        $amadou->createToken('auth_token');
        DB::table('password_reset_tokens')->insert([
            'email'      => 'amadou.diallo@mavilla.sn',
            'token'      => 'jeton',
            'created_at' => now(),
        ]);

        $this->neutraliser();

        $this->assertSame(0, $amadou->tokens()->count());
        $this->assertSame(0, DB::table('password_reset_tokens')->count());
    }

    public function test_ce_qui_lui_est_rattache_reste_en_place(): void
    {
        $amadou = $this->compte();
        $villa = Villa::factory()->create(['user_id' => $amadou->id]);

        $this->neutraliser();

        $this->assertSame($amadou->id, $villa->fresh()->user_id);
    }

    public function test_les_autres_comptes_ne_bougent_pas_et_rejouer_ne_change_rien(): void
    {
        $autre = User::factory()->create(['email' => 'awa@example.sn']);
        $amadou = $this->compte();

        $this->neutraliser();
        $adresse = $amadou->fresh()->email;
        $this->neutraliser();

        $this->assertSame('awa@example.sn', $autre->fresh()->email);
        $this->assertSame($adresse, $amadou->fresh()->email);
    }
}
