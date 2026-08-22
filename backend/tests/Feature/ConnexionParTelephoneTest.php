<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Se connecter par numéro **ou** par adresse.
 *
 * Beaucoup de propriétaires sénégalais n'ont pas d'adresse électronique qu'ils
 * consultent ; tous ont un numéro, et c'est celui qu'ils donnent. Ces tests
 * fixent trois choses : que les formes usuelles d'un même numéro mènent au
 * même compte, qu'un numéro ne puisse pas désigner deux comptes, et que
 * l'écran de connexion ne serve jamais d'annuaire.
 */
class ConnexionParTelephoneTest extends TestCase
{
    use RefreshDatabase;

    private function compte(string $telephone = '+221 77 123 45 67'): User
    {
        return User::factory()->create([
            'email'    => 'awa@example.sn',
            'phone'    => $telephone,
            'password' => Hash::make('motdepasse123'),
        ]);
    }

    /* ── La normalisation ────────────────────────────────────────── */

    /**
     * Le cœur du sujet : ces quatre écritures désignent la même ligne, et
     * personne ne se souvient de celle qu'il a saisie des mois plus tôt.
     */
    public function test_les_formes_usuelles_d_un_numero_menent_au_meme_compte(): void
    {
        $this->compte();

        foreach ([
            '+221 77 123 45 67',
            '77 123 45 67',
            '771234567',
            '221771234567',
            '+221-77-123-45-67',
        ] as $saisie) {
            $this->postJson('/api/auth/login', [
                'identifiant' => $saisie,
                'password'    => 'motdepasse123',
            ])->assertOk()->assertJsonStructure(['user', 'token']);
        }
    }

    public function test_l_adresse_fonctionne_toujours(): void
    {
        $this->compte();

        $this->postJson('/api/auth/login', [
            'identifiant' => 'awa@example.sn',
            'password'    => 'motdepasse123',
        ])->assertOk();
    }

    /**
     * Le front et l'API ne se déploient jamais ensemble : pendant la fenêtre,
     * l'écran ancien envoie encore `email`. Le refuser couperait la connexion
     * à tout le monde le temps du décalage.
     */
    public function test_l_ancien_champ_email_reste_accepte(): void
    {
        $this->compte();

        $this->postJson('/api/auth/login', [
            'email'    => 'awa@example.sn',
            'password' => 'motdepasse123',
        ])->assertOk();
    }

    /**
     * Un numéro étranger garde son indicatif : le retirer ferait entrer en
     * collision deux numéros de pays différents qui finissent pareil.
     */
    public function test_un_numero_etranger_garde_son_indicatif(): void
    {
        $francais = User::normaliserNumero('+33 6 12 34 56 78');
        $senegalais = User::normaliserNumero('+221 77 123 45 67');

        $this->assertSame('33612345678', $francais);
        $this->assertSame('771234567', $senegalais);
    }

    public function test_une_saisie_sans_chiffres_utiles_ne_normalise_rien(): void
    {
        $this->assertNull(User::normaliserNumero(''));
        $this->assertNull(User::normaliserNumero('12'));
        $this->assertNull(User::normaliserNumero(null));
    }

    /* ── L'écran de connexion n'est pas un annuaire ──────────────── */

    /**
     * Le message ne doit jamais permettre de savoir qui est inscrit : sinon on
     * teste des numéros jusqu'à trouver.
     */
    public function test_un_numero_inconnu_et_un_mauvais_mot_de_passe_disent_la_meme_chose(): void
    {
        $this->compte();

        $inconnu = $this->postJson('/api/auth/login', [
            'identifiant' => '77 999 99 99',
            'password'    => 'motdepasse123',
        ])->assertStatus(422);

        $mauvais = $this->postJson('/api/auth/login', [
            'identifiant' => '77 123 45 67',
            'password'    => 'pas-le-bon',
        ])->assertStatus(422);

        $this->assertSame(
            $inconnu->json('errors.identifiant'),
            $mauvais->json('errors.identifiant'),
            "Deux causes distinctes doivent produire exactement le même message."
        );
    }

    public function test_un_numero_illisible_ne_connecte_personne(): void
    {
        $this->compte();

        $this->postJson('/api/auth/login', [
            'identifiant' => 'aa',
            'password'    => 'motdepasse123',
        ])->assertStatus(422);
    }

    /**
     * La limite porte sur la forme canonique : sinon chaque écriture du même
     * numéro ouvrirait son propre compteur, et cinq essais deviendraient
     * vingt-cinq.
     */
    public function test_la_limite_de_tentatives_ne_se_contourne_pas_en_changeant_l_ecriture(): void
    {
        $this->compte();

        $ecritures = ['77 123 45 67', '+221771234567', '771234567', '221 77 123 45 67', '+221 77 123 45 67'];

        foreach ($ecritures as $saisie) {
            $this->postJson('/api/auth/login', [
                'identifiant' => $saisie,
                'password'    => 'pas-le-bon',
            ])->assertStatus(422);
        }

        // Le sixième essai, même avec le bon mot de passe, doit être refusé.
        $reponse = $this->postJson('/api/auth/login', [
            'identifiant' => '77 123 45 67',
            'password'    => 'motdepasse123',
        ])->assertStatus(422);

        $this->assertStringContainsString(
            'Trop de tentatives',
            $reponse->json('errors.identifiant.0')
        );
    }

    /* ── Un numéro ne désigne qu'un compte ───────────────────────── */

    public function test_l_inscription_refuse_un_numero_deja_pris(): void
    {
        $this->compte();

        $this->postJson('/api/auth/register', [
            'name'                  => 'Moussa Diop',
            'email'                 => 'moussa@example.sn',
            'phone'                 => '77 123 45 67',
            'password'              => 'motdepasse123',
            'password_confirmation' => 'motdepasse123',
        ])->assertStatus(422)->assertJsonValidationErrors('phone');
    }

    public function test_l_inscription_accepte_un_numero_libre(): void
    {
        $this->compte();

        $this->postJson('/api/auth/register', [
            'name'                  => 'Moussa Diop',
            'email'                 => 'moussa@example.sn',
            'phone'                 => '78 555 44 33',
            'password'              => 'motdepasse123',
            'password_confirmation' => 'motdepasse123',
        ])->assertCreated();

        $this->postJson('/api/auth/login', [
            'identifiant' => '+221 78 555 44 33',
            'password'    => 'motdepasse123',
        ])->assertOk();
    }

    public function test_le_profil_refuse_le_numero_d_un_autre(): void
    {
        $awa = $this->compte();
        $moussa = User::factory()->create(['email' => 'moussa@example.sn', 'phone' => '78 555 44 33']);

        $this->actingAs($moussa, 'sanctum')
            ->patchJson('/api/auth/profile', ['phone' => '+221 77 123 45 67'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('phone');

        $this->assertSame('+221 77 123 45 67', $awa->fresh()->phone);
    }

    public function test_le_profil_accepte_de_regarder_son_propre_numero(): void
    {
        $awa = $this->compte();

        $this->actingAs($awa, 'sanctum')
            ->patchJson('/api/auth/profile', ['phone' => '77 123 45 67', 'name' => 'Awa Ndiaye'])
            ->assertOk();
    }

    /* ── La forme canonique suit le numéro ───────────────────────── */

    /**
     * Le numéro se pose par quatre chemins (inscription, profil, peuplement,
     * console). Un seul oublié laisserait un compte inaccessible par son
     * numéro sans que rien ne le signale — d'où le mutateur.
     */
    public function test_changer_de_numero_deplace_la_connexion(): void
    {
        $awa = $this->compte();

        $this->actingAs($awa, 'sanctum')
            ->patchJson('/api/auth/profile', ['phone' => '76 000 11 22'])
            ->assertOk();

        $this->postJson('/api/auth/login', [
            'identifiant' => '77 123 45 67',
            'password'    => 'motdepasse123',
        ])->assertStatus(422);

        $this->postJson('/api/auth/login', [
            'identifiant' => '+221 76 000 11 22',
            'password'    => 'motdepasse123',
        ])->assertOk();
    }

    public function test_retirer_son_numero_ne_laisse_pas_de_trace_connectable(): void
    {
        $awa = $this->compte();

        $this->actingAs($awa, 'sanctum')
            ->patchJson('/api/auth/profile', ['phone' => null])
            ->assertOk();

        $this->assertNull($awa->fresh()->getAttribute('phone_normalise'));

        $this->postJson('/api/auth/login', [
            'identifiant' => '77 123 45 67',
            'password'    => 'motdepasse123',
        ])->assertStatus(422);
    }

    /** La colonne de travail n'a rien à faire dans une réponse. */
    public function test_la_forme_canonique_n_est_jamais_servie(): void
    {
        $awa = $this->compte();

        $reponse = $this->actingAs($awa, 'sanctum')->getJson('/api/auth/me')->assertOk();

        $this->assertArrayNotHasKey('phone_normalise', $reponse->json('user') ?? $reponse->json());
    }
}
