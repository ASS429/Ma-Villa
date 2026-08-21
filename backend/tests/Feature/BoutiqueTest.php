<?php

namespace Tests\Feature;

use App\Models\Commande;
use App\Models\Oeuvre;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * La boutique d'œuvres d'art.
 *
 * Deux règles portent tout le reste, et ce sont les deux seules qui coûtent
 * de l'argent si on les manque : **aucun montant ne vient de la requête**, et
 * **une œuvre ne se vend qu'une fois**.
 */
class BoutiqueTest extends TestCase
{
    use RefreshDatabase;

    private User $client;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->client = User::factory()->client()->create();
        $this->admin = User::factory()->admin()->create();

        config([
            'boutique.actif' => true,
            'boutique.paiement_a_la_livraison' => true,
            'boutique.livraison.zones' => [
                'dakar'   => ['nom' => 'Dakar', 'frais' => 2000, 'delai' => '24 h'],
                'regions' => ['nom' => 'Régions', 'frais' => 5000, 'delai' => '3 jours'],
                'retrait' => ['nom' => 'Retrait', 'frais' => 0, 'delai' => 'RDV'],
            ],
        ]);
    }

    private function oeuvre(array $attributs = []): Oeuvre
    {
        return Oeuvre::create(array_merge([
            'titre'     => 'Teranga',
            'artiste'   => 'Awa Diop',
            'categorie' => 'tableaux',
            'prix'      => 150000,
            'stock'     => 1,
            'statut'    => 'publiee',
        ], $attributs));
    }

    /** @return array<string, mixed> */
    private function commandeValide(Oeuvre $oeuvre, array $sup = []): array
    {
        return array_merge([
            'oeuvre_id'      => $oeuvre->id,
            'zone_livraison' => 'dakar',
            'mode_paiement'  => 'livraison',
            'destinataire'   => 'Fatou Ndiaye',
            'telephone'      => '+221 77 000 00 00',
            'adresse'        => 'Sacré-Cœur 3, villa 12',
            'ville'          => 'Dakar',
        ], $sup);
    }

    /* ── La boutique fermée n'existe pas ─────────────────────────── */

    /**
     * 404 et non 503 : un 503 dirait « ça existe, revenez plus tard » et
     * inviterait les moteurs à garder l'adresse.
     */
    public function test_la_boutique_fermee_repond_404(): void
    {
        config(['boutique.actif' => false]);
        $oeuvre = $this->oeuvre();

        $this->getJson('/api/oeuvres')->assertStatus(404);
        $this->getJson("/api/oeuvres/{$oeuvre->id}")->assertStatus(404);

        $this->actingAs($this->client, 'sanctum')
             ->postJson('/api/commandes', $this->commandeValide($oeuvre))
             ->assertStatus(404);

        $this->assertSame(0, Commande::count());
    }

    /* ── La vitrine ──────────────────────────────────────────────── */

    public function test_la_vitrine_cache_les_brouillons_mais_garde_les_vendues(): void
    {
        $this->oeuvre(['titre' => 'Publiée']);
        $this->oeuvre(['titre' => 'Vendue', 'statut' => 'vendue']);
        $this->oeuvre(['titre' => 'Brouillon', 'statut' => 'brouillon']);

        // Sur le JSON décodé : la réponse échappe les accents en é, et une
        // comparaison de chaînes brutes chercherait « Publiée » en vain.
        $titres = collect($this->getJson('/api/oeuvres')->assertOk()->json('data'))
            ->pluck('titre')->all();

        $this->assertContains('Publiée', $titres);
        $this->assertContains('Vendue', $titres, 'Une galerie qui efface ce qu\'elle a vendu perd la preuve qu\'elle vend.');
        $this->assertNotContains('Brouillon', $titres);
    }

    public function test_la_vitrine_montre_le_disponible_avant_le_vendu(): void
    {
        $this->oeuvre(['titre' => 'Déjà partie', 'statut' => 'vendue']);
        $this->oeuvre(['titre' => 'Encore là']);

        $liste = $this->getJson('/api/oeuvres')->json('data');

        $this->assertSame('Encore là', $liste[0]['titre']);
    }

    public function test_un_brouillon_est_introuvable_pour_le_public(): void
    {
        $oeuvre = $this->oeuvre(['statut' => 'brouillon']);

        $this->getJson("/api/oeuvres/{$oeuvre->id}")->assertStatus(404);
        $this->actingAs($this->admin, 'sanctum')->getJson("/api/oeuvres/{$oeuvre->id}")->assertOk();
    }

    /* ── L'argent ────────────────────────────────────────────────── */

    /**
     * Le prix vient de l'œuvre et les frais de la configuration. C'est la
     * leçon de la faille du tarif, où le client choisissait ce qu'il payait.
     */
    public function test_les_montants_envoyes_dans_la_requete_sont_ignores(): void
    {
        $oeuvre = $this->oeuvre(['prix' => 150000]);

        $reponse = $this->actingAs($this->client, 'sanctum')->postJson('/api/commandes', $this->commandeValide($oeuvre, [
            'montant_oeuvre'  => 1,
            'frais_livraison' => 0,
            'montant_total'   => 1,
            'prix'            => 1,
        ]));

        $reponse->assertStatus(201);

        $commande = Commande::first();
        $this->assertSame(150000, $commande->montant_oeuvre);
        $this->assertSame(2000, $commande->frais_livraison);
        $this->assertSame(152000, $commande->montant_total);
    }

    public function test_les_frais_suivent_la_zone(): void
    {
        foreach ([['dakar', 2000], ['regions', 5000], ['retrait', 0]] as [$zone, $frais]) {
            $oeuvre = $this->oeuvre();

            $this->actingAs($this->client, 'sanctum')
                 ->postJson('/api/commandes', $this->commandeValide($oeuvre, ['zone_livraison' => $zone]))
                 ->assertStatus(201);

            $commande = Commande::latest('id')->first();
            $this->assertSame($frais, $commande->frais_livraison, "Zone {$zone}");
            $this->assertSame(150000 + $frais, $commande->montant_total);
        }
    }

    public function test_une_zone_non_desservie_est_refusee(): void
    {
        $oeuvre = $this->oeuvre();

        $this->actingAs($this->client, 'sanctum')
             ->postJson('/api/commandes', $this->commandeValide($oeuvre, ['zone_livraison' => 'paris']))
             ->assertStatus(422);

        $this->assertSame(0, Commande::count());
    }

    /**
     * Le prix est recopié à la commande : le relever ensuite ne doit pas
     * réécrire une vente passée.
     */
    public function test_le_prix_est_fige_a_la_commande(): void
    {
        $oeuvre = $this->oeuvre(['prix' => 100000]);

        $this->actingAs($this->client, 'sanctum')
             ->postJson('/api/commandes', $this->commandeValide($oeuvre));

        $oeuvre->update(['prix' => 900000]);

        $this->assertSame(100000, Commande::first()->montant_oeuvre);
        $this->assertSame('Teranga', Commande::first()->oeuvre_titre);
    }

    /* ── Une œuvre ne se vend qu'une fois ────────────────────────── */

    public function test_commander_retire_l_oeuvre_de_la_vente(): void
    {
        $oeuvre = $this->oeuvre();

        $this->actingAs($this->client, 'sanctum')
             ->postJson('/api/commandes', $this->commandeValide($oeuvre))
             ->assertStatus(201);

        $this->assertSame('vendue', $oeuvre->refresh()->statut);
    }

    /**
     * Le cas qui compte : un second acheteur sur la même pièce. Vendre deux
     * fois la même toile est le seul incident qu'une galerie ne rattrape pas.
     */
    public function test_une_oeuvre_deja_vendue_ne_peut_plus_etre_commandee(): void
    {
        $oeuvre = $this->oeuvre();
        $autre = User::factory()->client()->create();

        $this->actingAs($this->client, 'sanctum')
             ->postJson('/api/commandes', $this->commandeValide($oeuvre))
             ->assertStatus(201);

        $this->actingAs($autre, 'sanctum')
             ->postJson('/api/commandes', $this->commandeValide($oeuvre))
             ->assertStatus(409);

        $this->assertSame(1, Commande::count());
    }

    /** Une œuvre en brouillon n'est pas non plus commandable. */
    public function test_un_brouillon_ne_peut_pas_etre_commande(): void
    {
        $oeuvre = $this->oeuvre(['statut' => 'brouillon']);

        $this->actingAs($this->client, 'sanctum')
             ->postJson('/api/commandes', $this->commandeValide($oeuvre))
             ->assertStatus(409);
    }

    /* ── L'annulation libère ─────────────────────────────────────── */

    public function test_annuler_remet_l_oeuvre_en_vente(): void
    {
        $oeuvre = $this->oeuvre();

        $this->actingAs($this->client, 'sanctum')
             ->postJson('/api/commandes', $this->commandeValide($oeuvre));
        $commande = Commande::first();

        $this->actingAs($this->client, 'sanctum')
             ->patchJson("/api/commandes/{$commande->id}/annuler")
             ->assertOk();

        $this->assertSame('annulee', $commande->refresh()->statut);
        $this->assertSame('publiee', $oeuvre->refresh()->statut, 'Une pièce immobilisée par une commande abandonnée est invendable.');
    }

    public function test_une_commande_expediee_ne_s_annule_plus(): void
    {
        $oeuvre = $this->oeuvre();
        $this->actingAs($this->client, 'sanctum')->postJson('/api/commandes', $this->commandeValide($oeuvre));
        $commande = Commande::first();
        $commande->update(['statut' => 'expediee']);

        $this->actingAs($this->client, 'sanctum')
             ->patchJson("/api/commandes/{$commande->id}/annuler")
             ->assertStatus(409);
    }

    /* ── Accès ───────────────────────────────────────────────────── */

    public function test_un_tiers_ne_voit_pas_la_commande_d_un_autre(): void
    {
        $oeuvre = $this->oeuvre();
        $this->actingAs($this->client, 'sanctum')->postJson('/api/commandes', $this->commandeValide($oeuvre));
        $commande = Commande::first();

        $intrus = User::factory()->client()->create();

        $this->actingAs($intrus, 'sanctum')->getJson("/api/commandes/{$commande->id}")->assertStatus(403);
        $this->actingAs($intrus, 'sanctum')->patchJson("/api/commandes/{$commande->id}/annuler")->assertStatus(403);
    }

    public function test_un_visiteur_ne_peut_pas_commander(): void
    {
        $oeuvre = $this->oeuvre();

        $this->postJson('/api/commandes', $this->commandeValide($oeuvre))->assertStatus(401);
        $this->assertSame(0, Commande::count());
    }

    public function test_seul_l_admin_gere_le_stock(): void
    {
        $oeuvre = $this->oeuvre();

        $this->actingAs($this->client, 'sanctum')
             ->postJson('/api/admin/oeuvres', ['titre' => 'X', 'artiste' => 'Y', 'prix' => 1000])
             ->assertStatus(403);

        $this->actingAs($this->client, 'sanctum')
             ->patchJson("/api/admin/oeuvres/{$oeuvre->id}", ['prix' => 1])
             ->assertStatus(403);
    }

    /**
     * Le jeton de facture identifie la transaction chez le prestataire : qui le
     * détient peut agir dessus.
     */
    public function test_le_jeton_du_prestataire_ne_sort_jamais(): void
    {
        $oeuvre = $this->oeuvre();
        $this->actingAs($this->client, 'sanctum')->postJson('/api/commandes', $this->commandeValide($oeuvre));
        $commande = Commande::first();
        $commande->update(['token_paydunya' => 'JETON-SECRET', 'reponse_prestataire' => ['x' => 1]]);

        $corps = $this->actingAs($this->client, 'sanctum')
                      ->getJson("/api/commandes/{$commande->id}")->getContent();

        $this->assertStringNotContainsString('JETON-SECRET', $corps);
        $this->assertStringNotContainsString('reponse_prestataire', $corps);
    }

    /* ── Le cycle de la commande ─────────────────────────────────── */

    public function test_payer_a_la_livraison_confirme_d_emblee(): void
    {
        $oeuvre = $this->oeuvre();

        $this->actingAs($this->client, 'sanctum')
             ->postJson('/api/commandes', $this->commandeValide($oeuvre, ['mode_paiement' => 'livraison']))
             ->assertStatus(201)
             ->assertJsonPath('statut', 'confirmee');
    }

    public function test_payer_en_ligne_reste_en_attente_jusqu_au_reglement(): void
    {
        $oeuvre = $this->oeuvre();

        $this->actingAs($this->client, 'sanctum')
             ->postJson('/api/commandes', $this->commandeValide($oeuvre, ['mode_paiement' => 'en_ligne']))
             ->assertStatus(201)
             ->assertJsonPath('statut', 'en_attente')
             ->assertJsonPath('statut_paiement', 'en_attente');
    }

    /** Livrer une commande payable à la livraison la solde : c'est là que l'argent passe. */
    public function test_livrer_solde_une_commande_payable_a_la_livraison(): void
    {
        $oeuvre = $this->oeuvre();
        $this->actingAs($this->client, 'sanctum')->postJson('/api/commandes', $this->commandeValide($oeuvre));
        $commande = Commande::first();

        $this->actingAs($this->admin, 'sanctum')
             ->patchJson("/api/admin/commandes/{$commande->id}/statut", ['statut' => 'livree'])
             ->assertOk();

        $commande->refresh();
        $this->assertSame('livree', $commande->statut);
        $this->assertSame('reussi', $commande->statut_paiement);
        $this->assertNotNull($commande->paye_le);
    }

    public function test_le_changement_de_statut_est_consigne(): void
    {
        $oeuvre = $this->oeuvre();
        $this->actingAs($this->client, 'sanctum')->postJson('/api/commandes', $this->commandeValide($oeuvre));
        $commande = Commande::first();

        $this->actingAs($this->admin, 'sanctum')
             ->patchJson("/api/admin/commandes/{$commande->id}/statut", ['statut' => 'expediee']);

        $this->assertDatabaseHas('journal_admin', [
            'action' => 'commande.statut',
            'cible_libelle' => 'Teranga',
        ]);
    }

    /** L'admin qui annule libère aussi l'œuvre. */
    public function test_l_admin_qui_annule_remet_l_oeuvre_en_vente(): void
    {
        $oeuvre = $this->oeuvre();
        $this->actingAs($this->client, 'sanctum')->postJson('/api/commandes', $this->commandeValide($oeuvre));
        $commande = Commande::first();

        $this->actingAs($this->admin, 'sanctum')
             ->patchJson("/api/admin/commandes/{$commande->id}/statut", ['statut' => 'annulee'])
             ->assertOk();

        $this->assertSame('publiee', $oeuvre->refresh()->statut);
    }

    /* ── Le stock ────────────────────────────────────────────────── */

    public function test_une_oeuvre_commandee_ne_se_supprime_pas(): void
    {
        $oeuvre = $this->oeuvre();
        $this->actingAs($this->client, 'sanctum')->postJson('/api/commandes', $this->commandeValide($oeuvre));

        $this->actingAs($this->admin, 'sanctum')
             ->deleteJson("/api/admin/oeuvres/{$oeuvre->id}")
             ->assertStatus(422);

        $this->assertDatabaseHas('oeuvres', ['id' => $oeuvre->id]);
    }

    public function test_une_oeuvre_jamais_commandee_se_supprime(): void
    {
        $oeuvre = $this->oeuvre();

        $this->actingAs($this->admin, 'sanctum')
             ->deleteJson("/api/admin/oeuvres/{$oeuvre->id}")
             ->assertOk();

        $this->assertDatabaseMissing('oeuvres', ['id' => $oeuvre->id]);
    }

    public function test_le_paiement_a_la_livraison_peut_etre_ferme(): void
    {
        config(['boutique.paiement_a_la_livraison' => false]);
        $oeuvre = $this->oeuvre();

        $this->actingAs($this->client, 'sanctum')
             ->postJson('/api/commandes', $this->commandeValide($oeuvre, ['mode_paiement' => 'livraison']))
             ->assertStatus(422);

        $this->assertSame(0, Commande::count());
    }

    /* ── Catégories ──────────────────────────────────────────────── */

    public function test_la_vitrine_filtre_par_categorie(): void
    {
        $this->oeuvre(['titre' => 'Un tableau', 'categorie' => 'tableaux']);
        $this->oeuvre(['titre' => 'Un bracelet', 'categorie' => 'bijoux']);

        $titres = collect($this->getJson('/api/oeuvres?categorie=bijoux')->assertOk()->json('data'))
            ->pluck('titre')->all();

        $this->assertSame(['Un bracelet'], $titres);
    }

    public function test_une_categorie_inconnue_est_refusee(): void
    {
        $this->getJson('/api/oeuvres?categorie=voitures')->assertStatus(422);
    }

    /**
     * Une catégorie vide n'est pas proposée : un filtre qui ne rend rien use la
     * confiance plus vite qu'il ne rend service.
     */
    public function test_les_categories_vides_ne_sont_pas_proposees(): void
    {
        $this->oeuvre(['titre' => 'Un bracelet', 'categorie' => 'bijoux']);

        $categories = $this->getJson('/api/oeuvres/categories')->assertOk()->json();

        $this->assertCount(1, $categories);
        $this->assertSame('bijoux', $categories[0]['cle']);
        $this->assertSame(1, $categories[0]['total']);
    }

    public function test_creer_un_article_sans_categorie_est_refuse(): void
    {
        $this->actingAs($this->admin, 'sanctum')
             ->postJson('/api/admin/oeuvres', ['titre' => 'X', 'artiste' => 'Y', 'prix' => 1000])
             ->assertStatus(422);
    }

    /* ── Stock ───────────────────────────────────────────────────── */

    /**
     * Le point que le vrai catalogue a imposé : la plupart des articles sont
     * reproductibles. Sans quantité, commander un bracelet aurait fait
     * disparaître les bracelets.
     */
    public function test_commander_un_article_en_serie_ne_retire_qu_un_exemplaire(): void
    {
        $oeuvre = $this->oeuvre(['categorie' => 'bijoux', 'stock' => 3]);

        $this->actingAs($this->client, 'sanctum')
             ->postJson('/api/commandes', $this->commandeValide($oeuvre))
             ->assertStatus(201);

        $oeuvre->refresh();
        $this->assertSame(2, $oeuvre->stock);
        $this->assertSame('publiee', $oeuvre->statut, 'Il en reste : l\'article doit rester en vente.');
    }

    public function test_le_dernier_exemplaire_epuise_l_article(): void
    {
        $oeuvre = $this->oeuvre(['categorie' => 'bijoux', 'stock' => 1]);

        $this->actingAs($this->client, 'sanctum')
             ->postJson('/api/commandes', $this->commandeValide($oeuvre));

        $oeuvre->refresh();
        $this->assertSame(0, $oeuvre->stock);
        $this->assertSame('vendue', $oeuvre->statut);
    }

    public function test_un_article_epuise_ne_peut_plus_etre_commande(): void
    {
        $oeuvre = $this->oeuvre(['categorie' => 'bijoux', 'stock' => 0]);

        $this->actingAs($this->client, 'sanctum')
             ->postJson('/api/commandes', $this->commandeValide($oeuvre))
             ->assertStatus(409);
    }

    public function test_annuler_rend_l_exemplaire_au_stock(): void
    {
        $oeuvre = $this->oeuvre(['categorie' => 'bijoux', 'stock' => 2]);

        $this->actingAs($this->client, 'sanctum')
             ->postJson('/api/commandes', $this->commandeValide($oeuvre));
        $commande = Commande::first();

        $this->actingAs($this->client, 'sanctum')
             ->patchJson("/api/commandes/{$commande->id}/annuler")
             ->assertOk();

        $this->assertSame(2, $oeuvre->refresh()->stock);
    }

    /** Réapprovisionner remet l'article en vente, sans second geste. */
    public function test_reapprovisionner_remet_en_vente(): void
    {
        $oeuvre = $this->oeuvre(['categorie' => 'bijoux', 'stock' => 0, 'statut' => 'vendue']);

        $this->actingAs($this->admin, 'sanctum')
             ->patchJson("/api/admin/oeuvres/{$oeuvre->id}", ['stock' => 5])
             ->assertOk();

        $oeuvre->refresh();
        $this->assertSame(5, $oeuvre->stock);
        $this->assertSame('publiee', $oeuvre->statut);
    }

    /** Mais republier sans stock reste refusé : rien ne serait livrable. */
    public function test_republier_sans_stock_est_refuse(): void
    {
        $oeuvre = $this->oeuvre(['categorie' => 'bijoux', 'stock' => 0, 'statut' => 'vendue']);

        $this->actingAs($this->admin, 'sanctum')
             ->patchJson("/api/admin/oeuvres/{$oeuvre->id}", ['statut' => 'publiee'])
             ->assertStatus(422);

        $this->assertSame('vendue', $oeuvre->refresh()->statut);
    }

    /** La vitrine montre l'épuisé, mais après le disponible. */
    public function test_l_epuise_passe_apres_le_disponible(): void
    {
        $this->oeuvre(['titre' => 'Epuise', 'categorie' => 'bijoux', 'stock' => 0, 'statut' => 'vendue']);
        $this->oeuvre(['titre' => 'Dispo', 'categorie' => 'bijoux', 'stock' => 4]);

        $titres = collect($this->getJson('/api/oeuvres')->json('data'))->pluck('titre')->all();

        $this->assertSame('Dispo', $titres[0]);
    }

    /* ── Le prix d'entrée ────────────────────────────────────────── */

    /**
     * « À partir de » doit porter sur toute la sélection, pas sur la page
     * affichée : calculé côté écran, il annonçait un plancher plus élevé que
     * le vrai dès que le catalogue dépassait une page.
     */
    public function test_le_prix_d_entree_porte_sur_toute_la_selection(): void
    {
        foreach ([90000, 70000, 50000, 30000, 12000, 8000] as $i => $prix) {
            $this->oeuvre(['titre' => "Article {$i}", 'categorie' => 'bijoux', 'prix' => $prix]);
        }

        $reponse = $this->getJson('/api/oeuvres?par_page=6&tri=prix_desc');

        $this->assertCount(6, $reponse->json('data'));
        $this->assertSame(8000, $reponse->json('prix_min'));
    }

    /** Un article épuisé ne fixe pas le prix d'entrée : on ne peut pas le vendre. */
    public function test_un_article_epuise_ne_fixe_pas_le_prix_d_entree(): void
    {
        $this->oeuvre(['titre' => 'Bradé mais épuisé', 'prix' => 1000, 'stock' => 0, 'statut' => 'vendue']);
        $this->oeuvre(['titre' => 'Disponible', 'prix' => 40000]);

        $this->assertSame(40000, $this->getJson('/api/oeuvres')->json('prix_min'));
    }

    /** Le filtre déplace le prix d'entrée avec lui. */
    public function test_le_prix_d_entree_suit_la_categorie(): void
    {
        $this->oeuvre(['titre' => 'Un bijou', 'categorie' => 'bijoux', 'prix' => 9000]);
        $this->oeuvre(['titre' => 'Un tableau', 'categorie' => 'tableaux', 'prix' => 250000]);

        $this->assertSame(9000, $this->getJson('/api/oeuvres')->json('prix_min'));
        $this->assertSame(250000, $this->getJson('/api/oeuvres?categorie=tableaux')->json('prix_min'));
    }

    /** Rien d'achetable : pas de prix annoncé plutôt qu'un prix trompeur. */
    public function test_sans_article_achetable_aucun_prix_n_est_annonce(): void
    {
        $this->oeuvre(['stock' => 0, 'statut' => 'vendue']);

        $this->assertNull($this->getJson('/api/oeuvres')->json('prix_min'));
    }
}
