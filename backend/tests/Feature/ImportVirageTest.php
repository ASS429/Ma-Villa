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

    public function test_rattachees_au_compte_inscrit_elles_sont_publiees(): void
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
        $this->assertSame(9, Villa::where('user_id', $import->compte->id)->where('statut', 'validee')->count());
    }

    public function test_completer_publie_ap3_et_montre_la_piscine_d_ap8(): void
    {
        $proprietaire = User::factory()->create(['role' => 'proprietaire']);
        $ap3 = Villa::factory()->create(['user_id' => $proprietaire->id, 'nom' => 'Appartement 3 chambres décoré · Virage']);
        $ap8 = $this->ap8CommeEnLigne($proprietaire);

        $bilan = app(ImportVirage::class)->completer();

        $this->assertSame(['publiee' => true, 'photos' => 2], $bilan);
        $this->assertSame('validee', $ap3->fresh()->statut);

        $ap8->refresh();
        $this->assertSame('Appartement 3 chambres, piscine et salle de sport · Almadies', $ap8->nom);
        $this->assertStringContainsString('piscine et salle de sport', $ap8->description);

        $photos = $ap8->photos()->get();
        $this->assertSame([
            'Appartement 3 chambres, piscine et salle de sport · Almadies — Salon',
            "Appartement 3 chambres, piscine et salle de sport · Almadies — Piscine de l'immeuble",
            'Appartement 3 chambres, piscine et salle de sport · Almadies — Cuisine équipée',
            'Appartement 3 chambres, piscine et salle de sport · Almadies — Chambre avec vue sur la mer',
            'Appartement 3 chambres, piscine et salle de sport · Almadies — Salle de sport',
        ], $photos->pluck('alt')->all());
        // Les photos déjà en ligne gardent leur fichier ; seules les deux nouvelles sont envoyées.
        $this->assertSame('https://exemple.test/salon.jpg', $photos[0]->url);
        $this->assertSame('https://exemple.test/cuisine.jpg', $photos[2]->url);
        $this->assertCount(2, Storage::disk('public')->files('uploads/virage'));

        $this->assertSame(['publiee' => false, 'photos' => 0], app(ImportVirage::class)->completer());
        $this->assertSame(5, $ap8->photos()->count());
    }

    public function test_completer_ne_publie_pas_ap3_restee_sous_le_compte_d_attente(): void
    {
        $attente = User::factory()->create(['role' => 'proprietaire', 'email' => ImportVirage::EMAIL_ATTENTE]);
        $ap3 = Villa::factory()->create(['user_id' => $attente->id, 'nom' => 'Appartement 3 chambres décoré · Virage']);

        app(ImportVirage::class)->completer();

        $this->assertSame('en_attente', $ap3->fresh()->statut);
    }

    /** AP8 telle que l'import du 29 octobre l'a mise en ligne. */
    private function ap8CommeEnLigne(User $proprietaire): Villa
    {
        $nom = 'Appartement 3 chambres · Almadies';
        $villa = Villa::factory()->validee()->create(['user_id' => $proprietaire->id, 'nom' => $nom]);
        $villa->forceFill(['majoration' => 0.14, 'circuit' => 'associe'])->save();

        foreach (['salon' => 'Salon', 'sejour' => 'Salon et salle à manger', 'cuisine' => 'Cuisine équipée',
            'chambre' => 'Chambre avec vue sur la mer', 'vue' => 'Vue depuis l’appartement'] as $fichier => $alt) {
            $villa->photos()->create([
                'url'   => "https://exemple.test/{$fichier}.jpg",
                'alt'   => "{$nom} — {$alt}",
                'ordre' => $villa->photos()->count(),
            ]);
        }

        return $villa;
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
