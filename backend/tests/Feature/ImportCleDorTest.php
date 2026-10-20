<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Photo;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use App\Services\ImportCleDor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * L'intégration des logements de Clé d'Or Immobilier et Services.
 *
 * Ce que ces tests protègent : **à qui appartiennent ces logements** — la
 * demande de l'exploitant —, et qu'un import ne se rejoue jamais : une annonce
 * que l'administration retire doit rester retirée.
 */
class ImportCleDorTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.media' => 'public']);
        Storage::fake('public');
    }

    public function test_les_annonces_sont_publiees_au_nom_de_cle_dor(): void
    {
        $bilan = app(ImportCleDor::class)->executer();

        $this->assertSame(['annonces' => 8, 'logements' => 12, 'photos' => 30], $bilan);

        $proprietaire = User::where('email', ImportCleDor::EMAIL)->sole();
        $this->assertSame("Clé d'Or Immobilier et Services", $proprietaire->name);
        $this->assertSame('proprietaire', $proprietaire->role);
        $this->assertNotNull($proprietaire->avatar, 'le logo de l\'agence sert d\'avatar');

        $villas = Villa::where('user_id', $proprietaire->id)->get();
        $this->assertCount(8, $villas);
        $this->assertTrue($villas->every(fn (Villa $v) => $v->statut === 'validee'));
        $this->assertTrue($villas->every(fn (Villa $v) => $v->telephone === ImportCleDor::TELEPHONE));
        $this->assertTrue($villas->every(fn (Villa $v) => str_starts_with($v->description, "Proposé par Clé d'Or")));

        // La fiche publique dit à qui appartient le logement.
        $sowdi = $villas->firstWhere('nom', 'Résidence SOWDI · Mermoz');
        $this->getJson("/api/villas/{$sowdi->id}")
            ->assertOk()
            ->assertJsonPath('proprietaire.name', "Clé d'Or Immobilier et Services")
            ->assertJsonPath('ville', 'Dakar')
            ->assertJsonPath('quartier', 'Mermoz');
    }

    public function test_une_residence_garde_ses_logements_et_leurs_prix_a_la_nuitee(): void
    {
        app(ImportCleDor::class)->executer();

        $sowdi = Villa::where('nom', 'Résidence SOWDI · Mermoz')->sole();
        $prix = Logement::where('villa_id', $sowdi->id)->with('tarifs')->get()
            ->mapWithKeys(fn (Logement $l) => [$l->nom => (int) $l->tarifs->sole()->prix]);

        $this->assertSame([
            'Studio présidentiel · 79 m²' => 95000,
            'Appartement 2 chambres (B) · 112 m²' => 130000,
            'Appartement 2 chambres (A) · 145 m²' => 140000,
            'Duplex 5 chambres · 536 m²' => 380000,
        ], $prix->all());

        $this->assertTrue(Tarif::all()->every(fn (Tarif $t) => $t->type_tarif === 'nuitee'));

        // Chaque logement est rangé dans une catégorie : sans elle, il
        // disparaîtrait de la recherche par catégorie.
        $this->assertSame(0, Logement::whereNull('categorie_id')->count());

        // Les annonces se trouvent par leur ville.
        $this->assertSame(3, $this->getJson('/api/villas?ville=Dakar')->json('total'));
        $this->assertSame(1, $this->getJson('/api/villas?ville=Somone')->json('total'));
    }

    public function test_les_photos_sont_dans_le_stockage_des_medias_dans_l_ordre(): void
    {
        app(ImportCleDor::class)->executer();

        $photos = Photo::orderBy('id')->get();
        $this->assertCount(30, $photos);
        $this->assertCount(31, Storage::disk('public')->allFiles('uploads/cle-dor'), '30 photos et le logo');

        $sorano = Villa::where('nom', 'F4 meublé · Résidence Sorano')->sole();
        $this->assertSame([0, 1, 2, 3, 4], $sorano->photos->pluck('ordre')->all());
        $this->assertStringContainsString('Grand salon', $sorano->photos->first()->alt);
    }

    /**
     * Le compte existe : on ne fait rien, même si une annonce a été retirée
     * entre-temps. Sinon elle reviendrait au démarrage suivant.
     */
    public function test_l_import_ne_se_rejoue_jamais(): void
    {
        app(ImportCleDor::class)->executer();
        Villa::where('nom', 'Villa 3 chambres avec piscine')->sole()->delete();

        $this->assertNull(app(ImportCleDor::class)->executer());
        $this->assertSame(7, Villa::count());
        $this->assertSame(1, User::where('email', ImportCleDor::EMAIL)->count());
    }

    /** Une photo qui ne part pas ne doit pas empêcher l'annonce d'exister. */
    public function test_un_stockage_en_panne_n_empeche_pas_les_annonces(): void
    {
        Storage::shouldReceive('disk')->andThrow(new \RuntimeException('stockage injoignable'));

        $bilan = app(ImportCleDor::class)->executer();

        $this->assertSame(8, $bilan['annonces']);
        $this->assertSame(0, $bilan['photos']);
        $this->assertNull(User::where('email', ImportCleDor::EMAIL)->sole()->avatar);
    }
}
