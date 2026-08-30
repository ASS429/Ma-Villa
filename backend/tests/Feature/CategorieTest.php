<?php

namespace Tests\Feature;

use App\Models\Categorie;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategorieTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Le catalogue proposé au public, dans l'ordre où il s'affiche.
     *
     * « Piscine seule » en est sortie le 28 août 2026 et « Résidence » y est
     * entrée. La piscine reste **en base**, désactivée : des logements s'y
     * rattachent, et les supprimer les ferait disparaître de la recherche.
     */
    public function test_les_categories_actives_sont_celles_du_catalogue(): void
    {
        $cles = Categorie::actives()->pluck('cle')->all();

        $this->assertEquals(
            ['villa', 'appartement', 'residence', 'studio', 'chambre', 'hotel', 'auberge'],
            $cles
        );
    }

    public function test_la_piscine_survit_en_base_mais_n_est_plus_proposee(): void
    {
        $piscine = Categorie::where('cle', 'piscine')->first();

        $this->assertNotNull($piscine, 'La ligne doit survivre : des logements la référencent.');
        $this->assertFalse((bool) $piscine->actif);
        $this->assertNotContains('piscine', Categorie::actives()->pluck('cle')->all());
    }

    public function test_une_categorie_porte_son_unite_de_prix_et_ses_formules(): void
    {
        // C'est tout l'intérêt du triplet : un studio se loue au mois, une
        // piscine à la journée, et aucune des deux ne redessine la carte.
        $studio = Categorie::where('cle', 'studio')->first();
        $piscine = Categorie::where('cle', 'piscine')->first();

        $this->assertEquals('mois', $studio->unite_prix);
        $this->assertEquals('journee', $piscine->unite_prix);

        // Une piscine ne se loue pas à la nuitée.
        $this->assertFalse($piscine->accepteFormule('nuitee'));
        $this->assertTrue($piscine->accepteFormule('demi_journee'));
    }

    public function test_les_logements_existants_sont_rattaches_a_une_categorie(): void
    {
        // La reprise doit être automatique : sans elle, les annonces déjà
        // publiées disparaîtraient de la recherche.
        $villa = Villa::factory()->validee()->create();
        $logement = $villa->logements()->create([
            'type' => 'villa_entiere', 'nom' => 'Ensemble', 'capacite' => 6, 'disponible' => true,
        ]);

        // Le rattachement se fait à la migration ; ici on vérifie la relation.
        $logement->update(['categorie_id' => Categorie::where('cle', 'villa')->value('id')]);

        $this->assertEquals('Villa', $logement->fresh()->categorie->nom);
    }

    public function test_la_recherche_filtre_par_categorie(): void
    {
        $idPiscine = Categorie::where('cle', 'piscine')->value('id');
        $idVilla   = Categorie::where('cle', 'villa')->value('id');

        $avecPiscine = Villa::factory()->validee()->create(['nom' => 'Avec piscine']);
        $avecPiscine->logements()->create([
            'type' => 'piscine', 'categorie_id' => $idPiscine,
            'nom' => 'Piscine', 'capacite' => 20, 'disponible' => true,
        ]);

        $villaSeule = Villa::factory()->validee()->create(['nom' => 'Villa seule']);
        $villaSeule->logements()->create([
            'type' => 'villa_entiere', 'categorie_id' => $idVilla,
            'nom' => 'Ensemble', 'capacite' => 6, 'disponible' => true,
        ]);

        $noms = collect($this->getJson('/api/villas?categorie=piscine')->assertOk()->json('data'))
            ->pluck('nom')->all();

        $this->assertEquals(['Avec piscine'], $noms);
    }

    public function test_une_categorie_inconnue_est_refusee(): void
    {
        $this->getJson('/api/villas?categorie=chateau')->assertStatus(422);
    }

    public function test_le_meuble_est_un_filtre_pas_une_categorie(): void
    {
        // En faire une catégorie doublerait chaque entrée.
        $meuble = Villa::factory()->validee()->create(['nom' => 'Meuble']);
        $meuble->logements()->create([
            'type' => 'appartement', 'nom' => 'A1', 'capacite' => 2,
            'disponible' => true, 'meuble' => true,
        ]);

        $vide = Villa::factory()->validee()->create(['nom' => 'Vide']);
        $vide->logements()->create([
            'type' => 'appartement', 'nom' => 'A2', 'capacite' => 2,
            'disponible' => true, 'meuble' => false,
        ]);

        $noms = collect($this->getJson('/api/villas?meuble=0')->assertOk()->json('data'))
            ->pluck('nom')->all();

        $this->assertEquals(['Vide'], $noms);
    }

    public function test_les_categories_sont_exposees_au_front(): void
    {
        $reponse = $this->getJson('/api/configuration')->assertOk();

        $this->assertCount(7, $reponse->json('categories'));
        $this->assertEquals('villa', $reponse->json('categories.0.cle'));
        $this->assertEquals('nuitee', $reponse->json('categories.0.unite_prix'));
        $this->assertIsArray($reponse->json('categories.0.formules'));
    }
}
