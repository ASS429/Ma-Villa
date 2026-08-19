<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Le verrou qui empêche de vendre deux fois la même nuit.
 *
 * `ReservationController::store` vérifie le chevauchement puis crée, le tout
 * dans une transaction précédée d'un `lockForUpdate` sur la ligne du logement.
 * Sans ce verrou, deux demandes simultanées constatent chacune un créneau libre
 * avant que l'autre n'ait écrit.
 *
 * ⚠️ **Ces tests ne s'exécutent que sur PostgreSQL.** La suite tourne sur
 * SQLite en mémoire, qui n'a pas de verrou de ligne : `lockForUpdate` y est
 * accepté et ignoré, si bien qu'un test écrit là-dessus passerait au vert sans
 * rien prouver. Pire que pas de test.
 *
 * Pour les exécuter, avec un PostgreSQL joignable :
 *
 *     docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=secret \
 *         -e POSTGRES_DB=mavilla_test --name pg-test postgres:16
 *
 *     DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_PORT=5432 \
 *     DB_DATABASE=mavilla_test DB_USERNAME=postgres DB_PASSWORD=secret \
 *     php artisan test --filter=ConcurrenceReservationTest
 *
 * La même commande sans `--filter` fait tourner **toute** la suite sur
 * PostgreSQL. Cela vaut la peine avant une mise en production : deux bugs sont
 * déjà passés à travers cent tests parce que la suite est sur SQLite et la
 * production sur Postgres — alias de SELECT dans un `HAVING`, et alias dans une
 * expression `ORDER BY`, tolérés par SQLite et refusés par Postgres.
 */
class ConcurrenceReservationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::connection()->getDriverName() !== 'pgsql') {
            $this->markTestSkipped(
                'Verrous de ligne : PostgreSQL requis. SQLite accepte '
                .'`lockForUpdate` sans rien verrouiller — le test passerait sans rien prouver.'
            );
        }

        // Une seconde connexion, sur la même base : c'est la seule façon
        // d'observer un verrou, qui par construction n'est visible que d'une
        // autre session.
        Config::set('database.connections.pgsql_concurrente', config('database.connections.pgsql'));
    }

    private function decor(): array
    {
        $proprietaire = User::factory()->proprietaire()->create();
        $villa = Villa::factory()->validee()->create(['user_id' => $proprietaire->id]);
        $logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'villa_entiere',
            'capacite' => 6, 'disponible' => true,
        ]);
        $tarif = Tarif::create([
            'logement_id' => $logement->id, 'type_tarif' => 'nuitee',
            'prix' => 100000, 'avec_clim' => false, 'avec_buffet' => false,
        ]);

        return compact('logement', 'tarif');
    }

    /**
     * Le cœur du correctif : tant qu'une session tient la ligne du logement,
     * une autre ne peut pas la prendre.
     */
    public function test_le_verrou_sur_le_logement_bloque_une_seconde_session(): void
    {
        ['logement' => $logement] = $this->decor();

        $a = DB::connection();
        $b = DB::connection('pgsql_concurrente');

        $a->beginTransaction();
        $a->table('logements')->where('id', $logement->id)->lockForUpdate()->first();

        $bloquee = false;

        try {
            $b->beginTransaction();
            // Sans délai, la seconde session attendrait indéfiniment et le test
            // ne finirait jamais. Un demi-seconde suffit : soit le verrou
            // existe et l'attente expire, soit il n'existe pas et la requête
            // passe immédiatement.
            $b->statement("SET LOCAL lock_timeout = '500ms'");
            $b->table('logements')->where('id', $logement->id)->lockForUpdate()->first();
            $b->rollBack();
        } catch (\Throwable $e) {
            $bloquee = str_contains($e->getMessage(), 'lock timeout')
                || str_contains($e->getMessage(), 'timeout');
            $b->rollBack();
        }

        $a->rollBack();

        $this->assertTrue(
            $bloquee,
            'La seconde session a pris le verrou : `lockForUpdate` ne protège rien, '
            .'et deux réservations simultanées peuvent passer.'
        );
    }

    /**
     * Une fois la première transaction terminée, la seconde voit sa
     * réservation et doit refuser — c'est ce que le verrou sérialise.
     */
    public function test_apres_le_verrou_la_seconde_demande_voit_le_conflit(): void
    {
        ['logement' => $logement, 'tarif' => $tarif] = $this->decor();
        $premier = User::factory()->client()->create();
        $second = User::factory()->client()->create();

        $debut = now()->addDays(5)->toDateString();
        $fin = now()->addDays(8)->toDateString();

        $this->actingAs($premier, 'sanctum')
             ->postJson('/api/reservations', [
                 'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
                 'date_debut' => $debut, 'date_fin' => $fin, 'nb_personnes' => 2,
             ])->assertStatus(201);

        // Chevauchement partiel : le conflit ne se limite pas aux dates égales.
        $this->actingAs($second, 'sanctum')
             ->postJson('/api/reservations', [
                 'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
                 'date_debut' => now()->addDays(7)->toDateString(),
                 'date_fin' => now()->addDays(10)->toDateString(),
                 'nb_personnes' => 2,
             ])->assertStatus(409);

        $this->assertSame(1, Reservation::count(), 'La nuit ne doit être vendue qu\'une fois.');
    }

    /**
     * Le verrou porte sur *un* logement, pas sur la table : deux réservations
     * sur des logements différents ne doivent pas s'attendre, sinon le site
     * s'effondre dès qu'il a du trafic.
     */
    public function test_deux_logements_differents_ne_s_attendent_pas(): void
    {
        ['logement' => $premier] = $this->decor();
        ['logement' => $second] = $this->decor();

        $a = DB::connection();
        $b = DB::connection('pgsql_concurrente');

        $a->beginTransaction();
        $a->table('logements')->where('id', $premier->id)->lockForUpdate()->first();

        $passee = false;
        try {
            $b->beginTransaction();
            $b->statement("SET LOCAL lock_timeout = '500ms'");
            $b->table('logements')->where('id', $second->id)->lockForUpdate()->first();
            $passee = true;
            $b->rollBack();
        } catch (\Throwable) {
            $b->rollBack();
        }

        $a->rollBack();

        $this->assertTrue($passee, 'Un verrou sur un logement ne doit pas bloquer les autres.');
    }
}
