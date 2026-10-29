<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Villa;
use App\Services\ImportVirage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ImportVirageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.media' => 'public', 'paiement.associes.majoration' => 0.14]);
        Storage::fake('public');
    }

    public function test_toutes_les_photos_du_dossier_existent(): void
    {
        $annonces = require base_path('database/donnees/virage/annonces.php');

        $this->assertCount(9, $annonces);
        foreach ($annonces as $annonce) {
            $this->assertLessThanOrEqual((int) config('annonces.photos_max'), count($annonce['photos']));
            foreach ($annonce['photos'] as [$fichier]) {
                $this->assertFileExists(base_path("database/donnees/virage/{$fichier}"));
            }
            $this->assertDoesNotMatchRegularExpression('/\d{1,3}[  ]\d{3}/u', $annonce['description'],
                'Un prix écrit dans la description contredirait la grille.');
        }
    }

    public function test_sans_le_compte_les_annonces_attendent_sous_un_compte_d_attente(): void
    {
        $bilan = app(ImportVirage::class)->executer();

        $this->assertFalse($bilan['rattachees']);
        $attente = User::where('email', ImportVirage::EMAIL_ATTENTE)->firstOrFail();
        $this->assertSame(9, Villa::where('user_id', $attente->id)->count());
        $this->assertSame(0, Villa::where('statut', 'validee')->count());
    }

    public function test_les_annonces_sont_majorees_et_dans_le_circuit_des_associes(): void
    {
        app(ImportVirage::class)->executer();

        $villa = Villa::where('nom', 'Studio meublé · Virage')->firstOrFail();
        $this->assertSame('associe', $villa->circuit);
        $this->assertSame(0.14, $villa->majoration);
        // 35 000 F demandés, 39 900 F arrondis aux 500 F supérieurs.
        $this->assertSame(40000, (int) $villa->logements()->first()->tarifs()->first()->prix);
        $this->assertSame(5, $villa->photos()->count());
    }

    public function test_l_import_ne_se_rejoue_pas(): void
    {
        app(ImportVirage::class)->executer();
        Villa::where('nom', 'Studio meublé · Virage')->first()->delete();

        $this->assertNull(app(ImportVirage::class)->executer());
        $this->assertSame(8, Villa::count());
    }

    public function test_rattachees_au_compte_inscrit_elles_sont_publiees_sauf_celle_a_confirmer(): void
    {
        $import = new class extends ImportVirage {
            public ?User $compte = null;

            protected function proprietaire(): ?User
            {
                return $this->compte;
            }
        };
        $import->compte = User::factory()->client()->create();

        $bilan = $import->executer();

        $this->assertTrue($bilan['rattachees']);
        $this->assertSame('proprietaire', $import->compte->fresh()->role);
        $this->assertSame(8, Villa::where('user_id', $import->compte->id)->where('statut', 'validee')->count());
        $this->assertSame('en_attente', Villa::where('nom', 'Appartement 3 chambres décoré · Virage')->value('statut'));
    }

    public function test_l_empreinte_retrouve_le_compte_quelle_que_soit_la_casse(): void
    {
        $import = new class extends ImportVirage {
            public function trouver(): ?User
            {
                return $this->proprietaire();
            }

            protected function empreinte(): string
            {
                return hash('sha256', 'proprio@exemple.sn');
            }
        };

        // Une adresse quelconque n'a pas l'empreinte : personne n'est rattaché par erreur.
        User::factory()->client()->create(['email' => 'quelquun@exemple.sn']);
        $this->assertNull($import->trouver());

        $compte = User::factory()->client()->create(['email' => 'Proprio@Exemple.sn']);
        $this->assertSame($compte->id, $import->trouver()?->id);
    }
}
