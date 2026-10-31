<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Villa;
use App\Services\ImportLot;
use App\Services\PrixSejour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ImportLotTest extends TestCase
{
    use RefreshDatabase;

    private const DOSSIER = 'database/donnees/lot-31-octobre';

    private const SUITE = 'database/donnees/lot-31-octobre-suite';

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.media' => 'public', 'paiement.associes.majoration' => 0.14]);
        Storage::fake('public');
    }

    private function importer(): ?array
    {
        return (new ImportLot(self::DOSSIER))->executer();
    }

    private function annonce(string $nom): Villa
    {
        return Villa::where('nom', $nom)->with('logements.tarifs')->firstOrFail();
    }

    public static function lots(): array
    {
        return ['premier lot' => [self::DOSSIER, 9], 'suite' => [self::SUITE, 3]];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('lots')]
    public function test_le_dossier_est_complet_et_les_descriptions_sans_prix(string $dossier, int $annonces): void
    {
        $lot = require base_path($dossier.'/annonces.php');

        $this->assertCount($annonces, $lot['annonces']);
        foreach ($lot['annonces'] as $annonce) {
            $this->assertArrayHasKey($annonce['proprietaire'], $lot['proprietaires']);
            $this->assertLessThanOrEqual((int) config('annonces.photos_max'), count($annonce['photos']));
            foreach ($annonce['photos'] as [$fichier]) {
                $this->assertFileExists(base_path("{$dossier}/{$fichier}"));
            }
            $this->assertDoesNotMatchRegularExpression('/\d{1,3}[  ]\d{3}/u', $annonce['description'],
                'Un prix écrit dans la description contredirait la grille.');
        }
        // Le dépôt est public : aucune adresse en clair.
        $this->assertStringNotContainsString('gmail', file_get_contents(base_path($dossier.'/annonces.php')));
    }

    public function test_sans_compte_les_annonces_paraissent_sous_un_compte_a_leur_nom(): void
    {
        $bilan = $this->importer();

        $this->assertSame(['jule' => false, 'modou-sene' => false, 'moussa' => false], $bilan['rattaches']);
        $this->assertSame(9, Villa::where('statut', 'validee')->count());
        $this->assertSame(45, $bilan['photos']);

        $modou = User::where('email', 'modou-sene@passetemps.sn')->firstOrFail();
        $this->assertSame('Modou Sene', $modou->name);
        $this->assertSame('proprietaire', $modou->role);
        $this->assertSame($modou->id, $this->annonce('Réceptif de 10 logements avec piscine · Ngaparou')->user_id);
        $this->assertSame(5, Villa::where('user_id', User::where('email', 'moussa@passetemps.sn')->value('id'))->count());
    }

    public function test_un_compte_inscrit_recoit_ses_annonces_et_devient_proprietaire(): void
    {
        $jule = User::factory()->client()->create();
        $import = new class(self::DOSSIER) extends ImportLot {
            public ?User $jule = null;

            protected function compte(?string $empreinte): ?User
            {
                return $empreinte === '5c8089fad01061570d74b4cba87e052bbc1b65b8bede6d5929e46a00a74d6d3b' ? $this->jule : null;
            }
        };
        $import->jule = $jule;

        $bilan = $import->executer();

        $this->assertTrue($bilan['rattaches']['jule']);
        $this->assertFalse($bilan['rattaches']['moussa']);
        $this->assertSame('proprietaire', $jule->fresh()->role);
        $this->assertSame(3, Villa::where('user_id', $jule->id)->count());
        $this->assertNull(User::where('email', 'jule@passetemps.sn')->first());
    }

    public function test_les_prix_sont_majores_et_les_longs_sejours_se_calculent(): void
    {
        $this->importer();

        // À la semaine : 450 000 F demandés, 513 000 F affichés ; sept nuits au moins.
        $maison = $this->annonce('Maison 3 chambres avec piscine · Saly');
        $this->assertSame('associe', $maison->circuit);
        $logement = $maison->logements->first();
        $tarif = $logement->tarifs->first();
        $this->assertSame(7, $logement->nuits_minimum);
        $this->assertSame(513000, $tarif->prix_semaine);
        $this->assertSame(513000, PrixSejour::pour($tarif, '2026-12-01', '2026-12-08')['montant']);

        // Au mois : 800 000 F demandés, 912 000 F pour trente nuits.
        $villa = $this->annonce('Villa meublée avec piscine · Ngaparou');
        $tarif = $villa->logements->first()->tarifs->first();
        $this->assertSame(30, $villa->logements->first()->nuits_minimum);
        $this->assertSame(912000, PrixSejour::pour($tarif, '2026-12-01', '2026-12-31')['montant']);

        // Le réceptif : dix logements de deux, avec ou sans les repas.
        $receptif = $this->annonce('Réceptif de 10 logements avec piscine · Ngaparou');
        $this->assertCount(10, $receptif->logements);
        $tarifs = $receptif->logements->first()->tarifs->sortBy('prix')->values();
        $this->assertSame([137000, 171000], $tarifs->pluck('prix')->map(fn ($p) => (int) $p)->all());
        $this->assertSame([false, true], $tarifs->pluck('avec_buffet')->all());

        // Les chambres d'Ouest Foire se louent une à une.
        $chambres = $this->annonce('Chambres en appartement · Ouest Foire')->logements;
        $this->assertCount(4, $chambres);
        $this->assertSame(40000, (int) $chambres->first()->tarifs->first()->prix);
    }

    public function test_la_suite_va_au_meme_compte_d_attente_que_le_premier_lot(): void
    {
        $this->importer();
        $bilan = (new ImportLot(self::SUITE))->executer();

        $this->assertSame(3, $bilan['annonces']);
        $jule = User::where('email', 'jule@passetemps.sn')->sole();
        $this->assertSame(6, Villa::where('user_id', $jule->id)->count());

        $ngor = $this->annonce('Villa 6 chambres rénovée avec piscine · Ngor');
        $this->assertSame(285000, (int) $ngor->logements->first()->tarifs->first()->prix);
        $this->assertCount(2, $this->annonce('Appartements 5 chambres vue mer · Ngor')->logements);

        // Au mois : 2 000 000 F demandés, 2 280 000 F pour trente nuits.
        $exception = $this->annonce('Appartement d\'exception 3 chambres · Almadies')->logements->first();
        $this->assertSame(30, $exception->nuits_minimum);
        $this->assertSame(2280000, PrixSejour::pour($exception->tarifs->first(), '2026-12-01', '2026-12-31')['montant']);
    }

    public function test_l_import_ne_se_rejoue_pas(): void
    {
        $this->importer();
        $this->annonce('Appartement meublé 2 chambres · Ngaparou')->delete();

        $this->assertNull($this->importer());
        $this->assertSame(8, Villa::count());
    }
}
