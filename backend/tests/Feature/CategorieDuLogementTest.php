<?php

namespace Tests\Feature;

use App\Models\Categorie;
use App\Models\Logement;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Un logement porte toujours une catégorie, quel que soit le chemin d'écriture.
 *
 * Relevé par l'exploitant le 23 septembre 2026 : « rien qu'avec les noms on
 * connaît le type de chaque hébergement, mais j'ai l'impression que le filtre
 * ne fonctionne pas ». Il ne fonctionnait pas du tout — les sept filtres
 * rendaient zéro sur dix annonces publiées.
 *
 * La recherche joint `logements.categorie_id`, et **personne ne l'écrivait** :
 * `LogementRequest` ne l'acceptait pas, et seule la migration du 12 août
 * l'avait rempli pour les logements d'alors.
 */
class CategorieDuLogementTest extends TestCase
{
    use RefreshDatabase;

    private User $proprietaire;
    private Villa $villa;

    protected function setUp(): void
    {
        parent::setUp();

        $this->proprietaire = User::factory()->proprietaire()->create();
        $this->villa = Villa::factory()->validee()->create(['user_id' => $this->proprietaire->id]);
    }

    private function creer(array $charge): Logement
    {
        $id = $this->actingAs($this->proprietaire, 'sanctum')
            ->postJson("/api/villas/{$this->villa->id}/logements", array_merge([
                'nom' => 'Le logement', 'capacite' => 4,
            ], $charge))
            ->assertCreated()
            ->json('id');

        return Logement::findOrFail($id);
    }

    /** Le cas de l'application mobile déjà distribuée : elle n'envoie que le type. */
    public function test_un_logement_cree_avec_le_type_seul_recoit_sa_categorie(): void
    {
        $logement = $this->creer(['type' => 'villa_entiere']);

        $this->assertNotNull($logement->categorie_id, 'Sans catégorie, la recherche ne le trouve pas');
        $this->assertSame('villa', $logement->categorie->cle);
    }

    /** Le cas du formulaire web, qui nomme désormais la catégorie. */
    public function test_un_logement_cree_avec_la_categorie_recoit_le_type(): void
    {
        $logement = $this->creer(['categorie' => 'auberge']);

        $this->assertSame('auberge', $logement->categorie->cle);
        // Le type suit, pour les lecteurs qui ne connaissent que lui.
        $this->assertSame('auberge', $logement->type);
    }

    /**
     * Les trois catégories que le type ne savait pas exprimer.
     *
     * Deux annonces publiées s'appellent « Auberge » : leur propriétaire ne
     * pouvait pas le dire.
     */
    public function test_les_categories_absentes_de_l_ancienne_enumeration_sont_acceptees(): void
    {
        foreach (['studio', 'hotel', 'auberge'] as $cle) {
            $logement = $this->creer(['categorie' => $cle, 'nom' => "Un {$cle}"]);

            $this->assertSame($cle, $logement->categorie->cle);
        }
    }

    /** Changer le type d'un logement doit déplacer sa catégorie, et l'inverse. */
    public function test_les_deux_colonnes_ne_divergent_jamais(): void
    {
        $logement = $this->creer(['type' => 'chambre']);

        $logement->update(['type' => 'appartement']);
        $this->assertSame('appartement', $logement->fresh()->categorie->cle);

        $logement->update(['categorie_id' => Categorie::where('cle', 'studio')->value('id')]);
        $this->assertSame('studio', $logement->fresh()->type);
    }

    /**
     * Le test qui reproduit le défaut : la recherche par catégorie doit trouver
     * une annonce publiée par l'API.
     */
    public function test_la_recherche_par_categorie_trouve_une_annonce_publiee(): void
    {
        $this->creer(['categorie' => 'auberge']);

        $trouvees = $this->getJson('/api/villas?categorie=auberge')->assertOk()->json('data');

        $this->assertCount(1, $trouvees);
        $this->assertSame($this->villa->id, $trouvees[0]['id']);

        // Et elle ne doit pas sortir sous une autre catégorie.
        $this->assertCount(0, $this->getJson('/api/villas?categorie=villa')->json('data'));
    }
}
