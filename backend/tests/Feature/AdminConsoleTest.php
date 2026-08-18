<?php

namespace Tests\Feature;

use App\Models\Avis;
use App\Models\Logement;
use App\Models\Paiement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Console d'administration enrichie — séries, activité, pagination.
 */
class AdminConsoleTest extends TestCase
{
    use RefreshDatabase;

    private function reservation(User $client, array $remplace = []): Reservation
    {
        $proprietaire = User::factory()->proprietaire()->create();
        $villa = Villa::factory()->validee()->create(['user_id' => $proprietaire->id]);
        $logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'villa_entiere',
            'capacite' => 4, 'disponible' => true,
        ]);
        $tarif = Tarif::create([
            'logement_id' => $logement->id, 'type_tarif' => 'nuitee',
            'prix' => 100000, 'avec_clim' => false, 'avec_buffet' => false,
        ]);

        return Reservation::create(array_merge([
            'user_id' => $client->id,
            'logement_id' => $logement->id,
            'tarif_id' => $tarif->id,
            'date_debut' => now()->addDays(3)->toDateString(),
            'date_fin' => now()->addDays(5)->toDateString(),
            'nb_personnes' => 2,
            'montant_total' => 200000,
            'statut' => 'confirmee',
        ], $remplace));
    }

    /* ── Séries temporelles ──────────────────────────────────────── */

    /**
     * Une série trouée se dessine comme une droite entre deux points éloignés,
     * ce qui invente une activité qui n'a pas eu lieu. Tous les jours doivent
     * être présents, y compris ceux à zéro.
     */
    public function test_les_series_couvrent_tous_les_jours_meme_sans_activite(): void
    {
        $admin = User::factory()->admin()->create();

        $reponse = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/statistiques');

        $reponse->assertOk();
        $jours = $reponse->json('jours');

        $this->assertCount(30, $jours);
        $this->assertSame(now()->subDays(29)->toDateString(), $jours[0]['date']);
        $this->assertSame(now()->toDateString(), $jours[29]['date']);

        foreach ($jours as $j) {
            $this->assertArrayHasKey('reservations', $j);
            $this->assertArrayHasKey('encaisse', $j);
            $this->assertIsNumeric($j['reservations']);
        }
    }

    public function test_une_reservation_du_jour_apparait_dans_la_serie(): void
    {
        $admin = User::factory()->admin()->create();
        $this->reservation(User::factory()->client()->create());

        $jours = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/statistiques')->json('jours');

        $this->assertSame(1, $jours[29]['reservations'], "La réservation d'aujourd'hui doit compter au dernier jour.");
    }

    public function test_les_villes_ne_listent_que_les_villas_publiees(): void
    {
        $admin = User::factory()->admin()->create();
        Villa::factory()->validee()->count(2)->create(['ville' => 'Saly']);
        Villa::factory()->create(['ville' => 'Mbour', 'statut' => 'en_attente']);

        $villes = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/statistiques')->json('villes');

        $this->assertSame('Saly', $villes[0]['ville']);
        $this->assertSame(2, $villes[0]['total']);
        $this->assertNotContains('Mbour', array_column($villes, 'ville'));
    }

    /* ── Fil d'activité ──────────────────────────────────────────── */

    public function test_le_fil_d_activite_melange_les_trois_flux(): void
    {
        $admin = User::factory()->admin()->create();
        $client = User::factory()->client()->create();
        $this->reservation($client);

        $activite = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/activite');

        $activite->assertOk();
        $types = array_column($activite->json(), 'type');

        $this->assertContains('villa', $types);
        $this->assertContains('compte', $types);
        $this->assertContains('reservation', $types);
    }

    public function test_le_fil_d_activite_est_plafonne(): void
    {
        $admin = User::factory()->admin()->create();
        User::factory()->client()->count(30)->create();

        $activite = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/activite');

        // Un fil sans plafond finit par charger toute la base à chaque ouverture.
        $this->assertLessThanOrEqual(12, count($activite->json()));
    }

    /* ── Pagination ──────────────────────────────────────────────── */

    /**
     * Les listes renvoyaient la table entière : à dix mille lignes, la réponse
     * et la mémoire du serveur s'effondrent — et c'est au lancement que le
     * volume arrive.
     */
    public function test_la_liste_des_utilisateurs_est_paginee(): void
    {
        $admin = User::factory()->admin()->create();
        User::factory()->client()->count(30)->create();

        $reponse = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/utilisateurs?par_page=10');

        $reponse->assertOk()->assertJsonStructure(['data', 'current_page', 'last_page', 'total']);
        $this->assertCount(10, $reponse->json('data'));
        $this->assertSame(31, $reponse->json('total'));
    }

    public function test_la_pagination_refuse_une_taille_de_page_demesuree(): void
    {
        $admin = User::factory()->admin()->create();

        // Sans plafond, `?par_page=100000` ramène tout et annule la pagination.
        $this->actingAs($admin, 'sanctum')
             ->getJson('/api/admin/utilisateurs?par_page=100000')
             ->assertStatus(422);
    }

    public function test_la_recherche_filtre_les_utilisateurs(): void
    {
        $admin = User::factory()->admin()->create();
        User::factory()->client()->create(['name' => 'Aminata Sow']);
        User::factory()->client()->count(5)->create();

        $reponse = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/utilisateurs?recherche=Aminata');

        $this->assertCount(1, $reponse->json('data'));
        $this->assertSame('Aminata Sow', $reponse->json('data.0.name'));
    }

    public function test_la_liste_des_villas_est_paginee_et_cherchable(): void
    {
        $admin = User::factory()->admin()->create();
        Villa::factory()->count(3)->create(['statut' => 'en_attente', 'ville' => 'Dakar']);
        Villa::factory()->create(['statut' => 'en_attente', 'nom' => 'Villa Océan', 'ville' => 'Saly']);

        $reponse = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/villas?statut=en_attente&recherche=Océan');

        $reponse->assertOk();
        $this->assertCount(1, $reponse->json('data'));
        $this->assertSame('Villa Océan', $reponse->json('data.0.nom'));
    }

    /* ── Chiffres de tête ────────────────────────────────────────── */

    /**
     * Le volume réservé et l'argent encaissé ne se confondent pas : une
     * réservation confirmée sans paiement abouti ne met aucun franc en caisse.
     */
    public function test_l_encaisse_se_distingue_du_volume_reserve(): void
    {
        $admin = User::factory()->admin()->create();
        $reservation = $this->reservation(User::factory()->client()->create());

        Paiement::create([
            'reservation_id' => $reservation->id,
            'methode' => 'wave',
            'statut' => 'reussi',
            'montant' => 150000,
            'commission' => 30000,
            'montant_proprietaire' => 120000,
            'reference' => 'MV-TEST00001',
            'paye_le' => now(),
        ]);

        $stats = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/stats');

        $this->assertEquals(200000, $stats->json('finances.volume_confirme'));
        $this->assertEquals(150000, $stats->json('finances.encaisse'));
        $this->assertEquals(30000, $stats->json('finances.commission'));
    }

    /**
     * Une progression depuis rien n'a pas de sens : « +100 % » sur un premier
     * inscrit serait un chiffre inventé.
     */
    public function test_la_variation_est_nulle_faute_de_periode_precedente(): void
    {
        $admin = User::factory()->admin()->create();

        $stats = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/stats');

        $this->assertNull($stats->json('utilisateurs.variation'));
    }

    public function test_la_note_moyenne_des_avis_est_exposee(): void
    {
        $admin = User::factory()->admin()->create();
        $client = User::factory()->client()->create();
        $villa = Villa::factory()->validee()->create();

        Avis::create(['user_id' => $client->id, 'villa_id' => $villa->id, 'note' => 5, 'commentaire' => 'Parfait']);
        Avis::create(['user_id' => $client->id, 'villa_id' => $villa->id, 'note' => 4, 'commentaire' => 'Bien']);

        $stats = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/stats');

        $this->assertEquals(2, $stats->json('avis.total'));
        $this->assertEquals(4.5, $stats->json('avis.note_moyenne'));
    }

    /* ── Accès ───────────────────────────────────────────────────── */

    public function test_les_nouvelles_routes_sont_refusees_a_un_client(): void
    {
        $client = User::factory()->client()->create();

        foreach (['/api/admin/statistiques', '/api/admin/activite'] as $route) {
            $this->actingAs($client, 'sanctum')->getJson($route)->assertStatus(403);
        }
    }

    /**
     * Test séparé du précédent, et non fusionné : dans un même test le garde
     * mémorise l'utilisateur déjà résolu, et une requête censée être anonyme
     * resterait authentifiée — elle répondrait 403 au lieu de 401, en donnant
     * l'illusion que le cas est couvert.
     */
    public function test_les_nouvelles_routes_sont_refusees_sans_authentification(): void
    {
        foreach (['/api/admin/statistiques', '/api/admin/activite'] as $route) {
            $this->getJson($route)->assertStatus(401);
        }
    }
}
