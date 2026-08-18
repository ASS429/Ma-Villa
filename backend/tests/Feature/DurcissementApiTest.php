<?php

namespace Tests\Feature;

use App\Models\Avis;
use App\Models\JournalAdmin;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * Limitation de débit, validation des URL de photo, journal d'audit.
 */
class DurcissementApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Les compteurs survivent d'un test à l'autre et feraient échouer le
        // second à cause du premier.
        RateLimiter::clear('');
        cache()->clear();
    }

    /* ── Limitation de débit ─────────────────────────────────────── */

    /**
     * L'authentification seule ne suffit pas : un compte légitime peut créer
     * des milliers de réservations, ou saturer un stockage facturé au volume.
     */
    public function test_les_avis_sont_limites_en_debit(): void
    {
        $client = User::factory()->client()->create();
        $villa = Villa::factory()->validee()->create();

        // Le plafond est de 5 par minute. Les premières requêtes échouent sur
        // la règle métier (pas de séjour), ce qui est sans importance ici :
        // seul compte le passage de 4xx métier à 429.
        for ($i = 0; $i < 5; $i++) {
            $this->actingAs($client, 'sanctum')
                 ->postJson('/api/avis', ['villa_id' => $villa->id, 'note' => 5]);
        }

        $this->actingAs($client, 'sanctum')
             ->postJson('/api/avis', ['villa_id' => $villa->id, 'note' => 5])
             ->assertStatus(429);
    }

    public function test_la_creation_de_reservation_est_limitee_en_debit(): void
    {
        $client = User::factory()->client()->create();

        for ($i = 0; $i < 10; $i++) {
            $this->actingAs($client, 'sanctum')->postJson('/api/reservations', []);
        }

        $this->actingAs($client, 'sanctum')
             ->postJson('/api/reservations', [])
             ->assertStatus(429);
    }

    /* ── URL de photo ────────────────────────────────────────────── */

    /**
     * L'URL n'était validée que comme chaîne. Un propriétaire pouvait
     * enregistrer n'importe quoi — pixel de suivi, image hébergée ailleurs
     * dont le contenu change après validation.
     */
    public function test_une_url_de_photo_sans_schema_http_est_refusee(): void
    {
        $proprietaire = User::factory()->proprietaire()->create();
        $villa = Villa::factory()->validee()->create(['user_id' => $proprietaire->id]);

        foreach (['javascript:alert(1)', 'pas-une-url', 'ftp://ailleurs.test/p.jpg'] as $url) {
            $this->actingAs($proprietaire, 'sanctum')
                 ->postJson("/api/villas/{$villa->id}/photos", ['photos' => [['url' => $url]]])
                 ->assertStatus(422);
        }

        $this->assertDatabaseCount('photos', 0);
    }

    public function test_une_url_https_reste_acceptee(): void
    {
        $proprietaire = User::factory()->proprietaire()->create();
        $villa = Villa::factory()->validee()->create(['user_id' => $proprietaire->id]);

        $this->actingAs($proprietaire, 'sanctum')
             ->postJson("/api/villas/{$villa->id}/photos", [
                 'photos' => [['url' => 'https://media.mavilla.sn/uploads/abc.jpg', 'alt' => 'Salon']],
             ])->assertStatus(201);

        $this->assertDatabaseCount('photos', 1);
    }

    /** Un seul appel pouvait insérer des milliers de lignes. */
    public function test_le_nombre_de_photos_par_envoi_est_plafonne(): void
    {
        $proprietaire = User::factory()->proprietaire()->create();
        $villa = Villa::factory()->validee()->create(['user_id' => $proprietaire->id]);

        $photos = array_fill(0, 41, ['url' => 'https://media.mavilla.sn/uploads/a.jpg']);

        $this->actingAs($proprietaire, 'sanctum')
             ->postJson("/api/villas/{$villa->id}/photos", ['photos' => $photos])
             ->assertStatus(422);
    }

    /* ── Journal d'audit ─────────────────────────────────────────── */

    public function test_valider_une_villa_laisse_une_trace(): void
    {
        $admin = User::factory()->admin()->create();
        $villa = Villa::factory()->create(['statut' => 'en_attente', 'nom' => 'Villa Baobab']);

        $this->actingAs($admin, 'sanctum')
             ->patchJson("/api/admin/villas/{$villa->id}/statut", ['statut' => 'validee'])
             ->assertOk();

        $trace = JournalAdmin::first();

        $this->assertNotNull($trace);
        $this->assertSame('villa.validee', $trace->action);
        $this->assertSame($admin->id, $trace->user_id);
        $this->assertSame('Villa Baobab', $trace->cible_libelle);
        $this->assertSame('en_attente', $trace->details['statut_avant']);
        $this->assertSame('validee', $trace->details['statut_apres']);
    }

    public function test_supprimer_un_compte_laisse_une_trace_nominative(): void
    {
        $admin = User::factory()->admin()->create();
        $client = User::factory()->client()->create(['name' => 'Aminata Sow']);

        $this->actingAs($admin, 'sanctum')
             ->deleteJson("/api/admin/utilisateurs/{$client->id}")
             ->assertOk();

        $trace = JournalAdmin::where('action', 'compte.supprime')->first();

        // Consignée avant la suppression : après, le nom a disparu et la trace
        // ne dirait plus qui a été fermé.
        $this->assertNotNull($trace);
        $this->assertSame('Aminata Sow', $trace->cible_libelle);
        $this->assertSame($client->email, $trace->details['email']);
    }

    /**
     * Un compte supprimé ne doit pas effacer ce qu'il a fait : un journal qui
     * disparaît avec son auteur ne prouve rien.
     */
    public function test_la_trace_survit_a_la_suppression_de_son_auteur(): void
    {
        $admin = User::factory()->admin()->create(['name' => 'Admin Sortant']);
        $villa = Villa::factory()->create(['statut' => 'en_attente']);

        $this->actingAs($admin, 'sanctum')
             ->patchJson("/api/admin/villas/{$villa->id}/statut", ['statut' => 'rejetee']);

        $admin->delete();

        $trace = JournalAdmin::first();

        $this->assertNotNull($trace, 'La trace ne doit pas être supprimée avec son auteur.');
        $this->assertNull($trace->user_id);
        $this->assertSame('Admin Sortant', $trace->auteur_nom);
    }

    public function test_le_journal_se_lit_et_se_filtre(): void
    {
        $admin = User::factory()->admin()->create();
        $villa = Villa::factory()->create(['statut' => 'en_attente']);
        $client = User::factory()->client()->create();
        $avis = Avis::create([
            'user_id' => $client->id, 'villa_id' => $villa->id, 'note' => 3, 'commentaire' => 'Bof',
        ]);

        $this->actingAs($admin, 'sanctum')
             ->patchJson("/api/admin/villas/{$villa->id}/statut", ['statut' => 'validee']);
        $this->actingAs($admin, 'sanctum')
             ->deleteJson("/api/admin/avis/{$avis->id}");

        $tout = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/journal');
        $tout->assertOk()->assertJsonStructure(['data', 'current_page', 'total']);
        $this->assertCount(2, $tout->json('data'));

        $filtre = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/journal?action=avis.supprime');
        $this->assertCount(1, $filtre->json('data'));
    }

    public function test_le_journal_reste_reserve_a_l_admin(): void
    {
        $client = User::factory()->client()->create();

        $this->actingAs($client, 'sanctum')->getJson('/api/admin/journal')->assertStatus(403);
    }

    /**
     * Une écriture de journal qui échoue ne doit jamais faire échouer l'action
     * métier : ce serait transformer une mesure de traçabilité en panne.
     */
    public function test_un_journal_indisponible_ne_bloque_pas_l_action(): void
    {
        $admin = User::factory()->admin()->create();
        $villa = Villa::factory()->create(['statut' => 'en_attente']);

        \Illuminate\Support\Facades\Schema::drop('journal_admin');

        $this->actingAs($admin, 'sanctum')
             ->patchJson("/api/admin/villas/{$villa->id}/statut", ['statut' => 'validee'])
             ->assertOk();

        $this->assertDatabaseHas('villas', ['id' => $villa->id, 'statut' => 'validee']);
    }
}
