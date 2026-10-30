<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use App\Services\Majoration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Les dates qu'un propriétaire ferme lui-même : il loue aussi ailleurs, et
 * sans elles le même soir se vendait deux fois. L'API existait depuis le début,
 * mais aucun écran ne s'en servait.
 */
class DatesFermeesTest extends TestCase
{
    use RefreshDatabase;

    private User $proprietaire;
    private Logement $logement;
    private Tarif $tarif;

    protected function setUp(): void
    {
        parent::setUp();

        $this->proprietaire = User::factory()->proprietaire()->create();
        $villa = Villa::factory()->validee()->create(['user_id' => $this->proprietaire->id]);
        $this->logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'chambre',
            'capacite' => 2, 'disponible' => true,
        ]);
        $this->tarif = Tarif::create(['logement_id' => $this->logement->id, 'type_tarif' => 'nuitee', 'prix' => 50000]);
    }

    private function fermer(int $debut, int $fin, array $plus = [])
    {
        return $this->actingAs($this->proprietaire, 'sanctum')
            ->postJson("/api/logements/{$this->logement->id}/disponibilites", [
                'date_debut' => now()->addDays($debut)->toDateString(),
                'date_fin'   => now()->addDays($fin)->toDateString(),
            ] + $plus);
    }

    private function demander(int $debut, int $fin)
    {
        return $this->actingAs(User::factory()->client()->create(), 'sanctum')
            ->postJson('/api/reservations', [
                'logement_id'  => $this->logement->id,
                'tarif_id'     => $this->tarif->id,
                'date_debut'   => now()->addDays($debut)->toDateString(),
                'date_fin'     => now()->addDays($fin)->toDateString(),
                'nb_personnes' => 1,
            ]);
    }

    public function test_une_plage_envoyee_sans_etat_est_fermee_et_bloque_la_reservation(): void
    {
        // La colonne vaut « ouverte » par défaut : sans la correction, la
        // plage s'enregistrait et ne bloquait rien.
        $this->fermer(10, 13, ['motif' => 'Loué sur Airbnb'])
            ->assertCreated()
            ->assertJsonPath('disponible', false)
            ->assertJsonPath('reservations_concernees', 0);

        $this->demander(11, 12)->assertStatus(409);
        $this->demander(20, 22)->assertCreated();
    }

    public function test_une_plage_qui_englobe_la_periode_demandee_est_trouvee(): void
    {
        $this->fermer(5, 30)->assertCreated();

        // L'ancien filtre ne regardait que les bornes : une fermeture du 5 au
        // 30 ne sortait pas pour une période du 10 au 12.
        $this->getJson("/api/logements/{$this->logement->id}/disponibilites?"
            .http_build_query([
                'date_debut' => now()->addDays(10)->toDateString(),
                'date_fin'   => now()->addDays(12)->toDateString(),
            ]))
            ->assertOk()
            ->assertJsonCount(1);
    }

    public function test_le_motif_ne_sort_que_pour_le_proprietaire(): void
    {
        $this->fermer(10, 13, ['motif' => 'Loué à M. Diop'])->assertCreated();
        $route = "/api/logements/{$this->logement->id}/disponibilites";

        $this->actingAs($this->proprietaire, 'sanctum')->getJson($route)
            ->assertJsonPath('0.motif', 'Loué à M. Diop');

        $this->app['auth']->forgetGuards();
        $public = $this->getJson($route)->assertOk();
        $this->assertArrayNotHasKey('motif', $public->json(0));

        $this->actingAs(User::factory()->client()->create(), 'sanctum')->getJson($route)
            ->assertJsonMissingPath('0.motif');
    }

    public function test_fermer_par_dessus_une_reservation_le_signale(): void
    {
        Reservation::create([
            'user_id' => User::factory()->client()->create()->id,
            'logement_id' => $this->logement->id, 'tarif_id' => $this->tarif->id,
            'date_debut' => now()->addDays(10)->toDateString(),
            'date_fin' => now()->addDays(12)->toDateString(),
            'nb_personnes' => 1, 'montant_total' => 100000, 'statut' => 'confirmee',
        ]);

        // Fermer n'annule rien : le propriétaire doit le savoir tout de suite.
        $this->fermer(11, 15)->assertCreated()->assertJsonPath('reservations_concernees', 1);
    }

    public function test_seul_le_proprietaire_ferme_et_rouvre(): void
    {
        $autre = User::factory()->proprietaire()->create();
        $route = "/api/logements/{$this->logement->id}/disponibilites";
        $dates = ['date_debut' => now()->addDays(10)->toDateString(), 'date_fin' => now()->addDays(12)->toDateString()];

        $this->actingAs($autre, 'sanctum')->postJson($route, $dates)->assertForbidden();

        $id = $this->fermer(10, 12)->json('id');
        $this->actingAs($autre, 'sanctum')->deleteJson("{$route}/{$id}")->assertForbidden();

        $this->actingAs($this->proprietaire, 'sanctum')->deleteJson("{$route}/{$id}")->assertOk();
        $this->demander(10, 12)->assertCreated();
    }

    public function test_une_date_passee_ou_une_plage_a_l_envers_est_refusee_en_francais(): void
    {
        $this->fermer(-2, 3)->assertStatus(422)
            ->assertJsonPath('errors.date_debut.0', 'On ne ferme pas une date déjà passée.');
        $this->fermer(5, 4)->assertStatus(422)
            ->assertJsonPath('errors.date_fin.0', 'La fin ne peut pas précéder le début.');
    }

    public function test_un_seul_jour_se_ferme(): void
    {
        // Bornes incluses : fermer le 5, c'est fermer du 5 au 5.
        $this->fermer(5, 5)->assertCreated();

        // Pas le départ le 5 : SQLite range la date avec « 00:00:00 », et la
        // borne exacte ne s'y compare pas comme sous PostgreSQL.
        $this->demander(4, 6)->assertStatus(409);
        $this->demander(5, 7)->assertStatus(409);
        $this->demander(7, 9)->assertCreated();
    }

    public function test_la_fiche_dit_qui_encaisse_sans_dire_combien(): void
    {
        $villa = $this->logement->villa;

        $this->getJson("/api/villas/{$villa->id}")
            ->assertJsonPath('encaisse_par_la_plateforme', false);

        Majoration::appliquer($villa);

        $fiche = $this->getJson("/api/villas/{$villa->id}")
            ->assertJsonPath('encaisse_par_la_plateforme', true);
        $this->assertArrayNotHasKey('circuit', $fiche->json());
        $this->assertArrayNotHasKey('majoration', $fiche->json());
    }
}
