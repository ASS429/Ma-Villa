<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Une ville saisie librement ne doit plus produire une destination par annonce.
 *
 * Les saisies employées ici sont celles relevées en production le 11 septembre
 * 2026 : six annonces, six « destinations », dont cinq désignaient Saly.
 */
class VilleDesAnnoncesTest extends TestCase
{
    use RefreshDatabase;

    public function test_la_ville_est_rangee_des_l_ecriture(): void
    {
        $proprietaire = User::factory()->proprietaire()->create();

        $this->actingAs($proprietaire, 'sanctum')
            ->postJson('/api/villas', ['nom' => 'Villa sylla', 'ville' => 'Saly velingara'])
            ->assertStatus(201)
            ->assertJsonFragment(['ville' => 'Saly', 'quartier' => 'Velingara']);

        $this->assertDatabaseHas('villas', [
            'nom' => 'Villa sylla', 'ville' => 'Saly', 'quartier' => 'Velingara',
        ]);
    }

    public function test_un_enregistrement_d_etape_n_efface_pas_le_quartier(): void
    {
        // Le formulaire de publication renvoie le nom et la ville à chaque
        // étape, jamais le quartier. Sans précaution, l'étape suivante
        // effacerait la précision rangée à l'étape précédente.
        $proprietaire = User::factory()->proprietaire()->create();
        $villa = Villa::factory()->create([
            'user_id'  => $proprietaire->id,
            'ville'    => 'Saly',
            'quartier' => 'Velingara',
        ]);

        $this->actingAs($proprietaire, 'sanctum')
            ->putJson("/api/villas/{$villa->id}", ['nom' => 'Villa sylla', 'ville' => 'Saly'])
            ->assertOk();

        $this->assertSame('Velingara', $villa->fresh()->quartier);
    }

    public function test_les_variantes_d_un_meme_lieu_ne_font_qu_une_destination(): void
    {
        $proprietaire = User::factory()->proprietaire()->create();

        foreach (['Saly velingara', 'Saly bambara', 'Saly derrière rdc', 'Mbour Saly'] as $rang => $saisie) {
            $id = $this->actingAs($proprietaire, 'sanctum')
                ->postJson('/api/villas', ['nom' => "Annonce {$rang}", 'ville' => $saisie])
                ->json('id');

            // La modération n'est pas le sujet de ce test : on publie sans
            // passer par la file d'attente.
            Villa::whereKey($id)->update(['statut' => 'validee']);
        }

        $destinations = $this->getJson('/api/destinations')->assertOk()->json();

        $this->assertCount(1, $destinations, 'Quatre façons d’écrire Saly font une seule destination');
        $this->assertSame('Saly', $destinations[0]['ville']);
        $this->assertSame(4, $destinations[0]['nb']);
    }

    public function test_la_recherche_par_l_ancienne_saisie_trouve_toujours(): void
    {
        // Les liens WhatsApp déjà partagés portent l'ancienne écriture : ils
        // doivent continuer de mener quelque part.
        Villa::factory()->validee()->create(['ville' => 'Saly', 'quartier' => 'Velingara']);
        Villa::factory()->validee()->create(['ville' => 'Dakar']);

        $trouvees = $this->getJson('/api/villas?ville='.urlencode('Saly velingara'))
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $trouvees);
        $this->assertSame('Saly', $trouvees[0]['ville']);
    }

    public function test_les_villes_proposees_sont_servies_par_la_configuration(): void
    {
        // L'interface en tenait deux listes écrites à la main, qui divergeaient
        // déjà. Celle-ci est la seule, et c'est celle que le serveur applique.
        $villes = $this->getJson('/api/configuration')->assertOk()->json('annonces.villes');

        $this->assertContains('Saly', $villes);
        $this->assertContains('Dakar', $villes);
    }

    /**
     * Ce que la recherche propose en premier doit mener quelque part.
     *
     * La liste servie était celle de l'algorithme, du plus précis au plus
     * général : les six pastilles de la feuille mobile étaient donc Saly puis
     * cinq villages **sans une seule annonce**, et ni Dakar ni Thiès. Relevé par
     * l'exploitant le 23 septembre 2026.
     */
    public function test_la_recherche_propose_d_abord_les_villes_pourvues(): void
    {
        Villa::factory()->count(3)->validee()->create(['ville' => 'Dakar']);
        Villa::factory()->validee()->create(['ville' => 'Saly']);
        // En attente de modération : la ville n'a rien à proposer.
        Villa::factory()->create(['ville' => 'Kolda', 'statut' => 'en_attente']);

        $annonces = $this->getJson('/api/configuration')->assertOk()->json('annonces');

        $this->assertSame(['Dakar', 'Saly'], $annonces['villes_pourvues'], 'La mieux pourvue en tête');
        $this->assertSame(['Dakar', 'Saly'], array_slice($annonces['villes'], 0, 2));

        // Les villes sans annonce restent proposées — il faut pouvoir publier
        // à Kolda — mais après, et par ordre alphabétique.
        $this->assertContains('Kolda', $annonces['villes']);
        $this->assertSame('Cap Skirring', $annonces['villes'][2]);
    }
}
