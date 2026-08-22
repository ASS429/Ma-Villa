<?php

namespace Tests\Feature;

use App\Models\Categorie;
use App\Models\Logement;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Publier une villa, par étapes.
 *
 * L'ancien formulaire exigeait tout d'un coup : nom, description, adresse,
 * téléphone, logement, tarif. Un propriétaire qui s'arrêtait au milieu perdait
 * sa saisie — et **cette perte ne se mesure nulle part**, puisque personne ne
 * vient se plaindre d'une annonce qu'il n'a pas créée.
 *
 * Ce que ces tests protègent : qu'on puisse commencer avec presque rien, que
 * rien d'incomplet n'atteigne la modération, et que le brouillon n'existe pour
 * personne d'autre que son auteur.
 */
class PublierUneVillaTest extends TestCase
{
    use RefreshDatabase;

    private User $proprietaire;

    protected function setUp(): void
    {
        parent::setUp();
        $this->proprietaire = User::factory()->proprietaire()->create();
    }

    private function commencer(array $donnees = []): Villa
    {
        $reponse = $this->actingAs($this->proprietaire, 'sanctum')
            ->postJson('/api/villas', array_merge([
                'nom'   => 'Villa Baobab',
                'ville' => 'Saly',
            ], $donnees))
            ->assertCreated();

        return Villa::findOrFail($reponse->json('id'));
    }

    /** Complète le brouillon jusqu'à ce qu'il soit publiable. */
    private function completer(Villa $villa): Villa
    {
        $villa->update([
            'adresse'     => 'Route de Ngaparou',
            'telephone'   => '+221 77 123 45 67',
            'description' => 'Une villa avec piscine, à cinq minutes de la plage.',
        ]);

        $logement = Logement::create([
            'villa_id' => $villa->id,
            'categorie_id' => Categorie::first()?->id,
            'nom' => 'Villa entière', 'type' => 'villa_entiere',
            'capacite' => 6, 'disponible' => true,
        ]);

        Tarif::create([
            'logement_id' => $logement->id, 'type_tarif' => 'nuitee',
            'prix' => 85000, 'avec_clim' => true, 'avec_buffet' => false,
        ]);

        return $villa->fresh();
    }

    /* ── Commencer ne coûte presque rien ─────────────────────────── */

    public function test_un_nom_et_une_ville_suffisent_a_commencer(): void
    {
        $villa = $this->commencer();

        $this->assertSame('brouillon', $villa->statut);
        $this->assertNull($villa->description);
        $this->assertNull($villa->adresse);
    }

    /**
     * Le point qui justifie tout l'état « brouillon » : sans lui, l'annonce
     * arriverait chez l'administrateur dès la première étape, et il passerait
     * ses journées à rejeter des ébauches.
     */
    public function test_un_brouillon_n_entre_pas_dans_la_file_de_moderation(): void
    {
        $this->commencer();

        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/villas?statut=en_attente')
            ->assertOk()
            ->assertJsonPath('total', 0);

        $cles = array_column(
            $this->actingAs($admin, 'sanctum')->getJson('/api/admin/attentes')->assertOk()->json('lignes'),
            'cle'
        );

        $this->assertNotContains('villas', $cles);
    }

    public function test_un_brouillon_n_apparait_pas_au_public(): void
    {
        $villa = $this->commencer();

        $this->getJson('/api/villas')->assertOk()->assertJsonPath('total', 0);

        // Un tiers connecté, et non un visiteur anonyme : `actingAs` survit à
        // la requête précédente, et interroger « sans compte » juste après
        // avoir créé le brouillon reviendrait à l'interroger en tant que son
        // auteur — qui a bien le droit de le voir.
        $curieux = User::factory()->client()->create();

        $this->actingAs($curieux, 'sanctum')
            ->getJson("/api/villas/{$villa->id}")
            ->assertNotFound();
    }

    /** Le propriétaire, lui, doit pouvoir relire son brouillon pour le reprendre. */
    public function test_le_proprietaire_peut_relire_son_brouillon(): void
    {
        $villa = $this->commencer();

        $this->actingAs($this->proprietaire, 'sanctum')
            ->getJson("/api/villas/{$villa->id}")
            ->assertOk()
            ->assertJsonPath('statut', 'brouillon');
    }

    public function test_le_proprietaire_retrouve_son_brouillon(): void
    {
        $villa = $this->commencer();

        $this->actingAs($this->proprietaire, 'sanctum')
            ->getJson('/api/proprietaire/villas')
            ->assertOk()
            ->assertJsonPath('0.id', $villa->id)
            ->assertJsonPath('0.statut', 'brouillon');
    }

    /* ── Publier vérifie, et dit où reprendre ────────────────────── */

    public function test_un_brouillon_vide_ne_se_publie_pas(): void
    {
        $villa = $this->commencer();

        $reponse = $this->actingAs($this->proprietaire, 'sanctum')
            ->postJson("/api/villas/{$villa->id}/publier")
            ->assertStatus(422);

        $etapes = array_column($reponse->json('manques'), 'etape');

        $this->assertContains('adresse', $etapes);
        $this->assertContains('description', $etapes);
        $this->assertContains('logement', $etapes);
        $this->assertSame('brouillon', $villa->fresh()->statut);
    }

    /**
     * Le refus nomme l'étape, pas le champ. « tarif_id manquant » ne dit pas
     * quoi faire ; « Aucun tarif n'a été fixé » renvoie quelque part.
     */
    public function test_le_refus_nomme_l_etape_a_reprendre(): void
    {
        $villa = $this->completer($this->commencer());
        $villa->logements()->first()->tarifs()->delete();

        $reponse = $this->actingAs($this->proprietaire, 'sanctum')
            ->postJson("/api/villas/{$villa->id}/publier")
            ->assertStatus(422);

        $this->assertSame([['etape' => 'prix', 'message' => "Aucun tarif n'a été fixé."]],
            $reponse->json('manques'));
    }

    public function test_un_brouillon_complet_part_en_validation(): void
    {
        $villa = $this->completer($this->commencer());

        $this->actingAs($this->proprietaire, 'sanctum')
            ->postJson("/api/villas/{$villa->id}/publier")
            ->assertOk()
            ->assertJsonPath('statut', 'en_attente');
    }

    /**
     * Les photos ne conditionnent pas la publication : le plafond de cinq est
     * une limite de stockage, pas un seuil de qualité. Arbitrage explicite de
     * l'utilisateur, contre la planche 27.
     */
    public function test_une_annonce_sans_photo_se_publie_quand_meme(): void
    {
        $villa = $this->completer($this->commencer());

        $this->assertCount(0, $villa->photos);

        $this->actingAs($this->proprietaire, 'sanctum')
            ->postJson("/api/villas/{$villa->id}/publier")
            ->assertOk();
    }

    /* ── Ce que la publication n'autorise pas ────────────────────── */

    public function test_on_ne_publie_pas_l_annonce_d_un_autre(): void
    {
        $villa = $this->completer($this->commencer());
        $autre = User::factory()->proprietaire()->create();

        $this->actingAs($autre, 'sanctum')
            ->postJson("/api/villas/{$villa->id}/publier")
            ->assertForbidden();

        $this->assertSame('brouillon', $villa->fresh()->statut);
    }

    public function test_on_ne_republie_pas_une_annonce_deja_en_ligne(): void
    {
        $villa = $this->completer($this->commencer());
        $villa->update(['statut' => 'validee']);

        $this->actingAs($this->proprietaire, 'sanctum')
            ->postJson("/api/villas/{$villa->id}/publier")
            ->assertStatus(422);
    }

    /**
     * Une annonce refusée doit pouvoir être corrigée et resoumise, sinon le
     * motif de refus ne sert à rien.
     */
    public function test_une_annonce_rejetee_se_resoumet(): void
    {
        $villa = $this->completer($this->commencer());
        $villa->update(['statut' => 'rejetee']);

        $this->actingAs($this->proprietaire, 'sanctum')
            ->postJson("/api/villas/{$villa->id}/publier")
            ->assertOk()
            ->assertJsonPath('statut', 'en_attente');
    }

    /* ── Les repères de prix ─────────────────────────────────────── */

    /**
     * Le net, toujours : c'est l'étape où le propriétaire hésite le plus, et
     * celle où il découvrirait sinon la commission après sa première
     * réservation.
     */
    public function test_le_net_du_proprietaire_est_toujours_donne(): void
    {
        $this->actingAs($this->proprietaire, 'sanctum')
            ->getJson('/api/reperes-de-prix?ville=Saly&prix=100000')
            ->assertOk()
            ->assertJsonPath('net.proprietaire', 85000)
            ->assertJsonPath('net.commission', 15000);
    }

    /**
     * ⚠️ Le test le plus important du lot. À Ziguinchor avec neuf villas, une
     * fourchette est une invention — et c'est nous qui l'aurions soufflée au
     * propriétaire.
     */
    public function test_aucune_fourchette_n_est_donnee_sans_assez_d_annonces(): void
    {
        $this->villesAvecTarifs('Ziguinchor', 4, 60000);

        $this->actingAs($this->proprietaire, 'sanctum')
            ->getJson('/api/reperes-de-prix?ville=Ziguinchor')
            ->assertOk()
            ->assertJsonPath('comparable', false)
            ->assertJsonMissingPath('bas')
            ->assertJsonMissingPath('haut');
    }

    public function test_une_fourchette_apparait_au_dela_du_seuil(): void
    {
        $this->villesAvecTarifs('Saly', 12, 60000);

        $reponse = $this->actingAs($this->proprietaire, 'sanctum')
            ->getJson('/api/reperes-de-prix?ville=Saly')
            ->assertOk()
            ->assertJsonPath('comparable', true);

        $this->assertGreaterThan(0, $reponse->json('bas'));
        $this->assertGreaterThanOrEqual($reponse->json('bas'), $reponse->json('haut'));
    }

    /** Un brouillon ne compte pas : il ne se loue pas, donc il n'est pas un prix pratiqué. */
    public function test_les_brouillons_ne_comptent_pas_dans_la_fourchette(): void
    {
        $this->villesAvecTarifs('Mbour', 12, 60000, statut: 'brouillon');

        $this->actingAs($this->proprietaire, 'sanctum')
            ->getJson('/api/reperes-de-prix?ville=Mbour')
            ->assertOk()
            ->assertJsonPath('comparable', false)
            ->assertJsonPath('annonces', 0);
    }

    private function villesAvecTarifs(string $ville, int $combien, int $prixBase, string $statut = 'validee'): void
    {
        for ($i = 0; $i < $combien; $i++) {
            $villa = Villa::factory()->create([
                'user_id' => $this->proprietaire->id,
                'ville'   => $ville,
                'statut'  => $statut,
            ]);

            $logement = Logement::create([
                'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'villa_entiere',
                'capacite' => 4, 'disponible' => true,
            ]);

            Tarif::create([
                'logement_id' => $logement->id, 'type_tarif' => 'nuitee',
                'prix' => $prixBase + $i * 5000, 'avec_clim' => false, 'avec_buffet' => false,
            ]);
        }
    }
}
