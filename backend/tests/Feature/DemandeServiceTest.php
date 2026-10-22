<?php

namespace Tests\Feature;

use App\Models\DemandeService;
use App\Models\JournalAdmin;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Les demandes de service des accompagnants — JOJ Dakar 2026.
 *
 * Ce que ces tests protègent : **une demande ne se perd pas.** Le message
 * WhatsApp peut ne jamais partir ; la demande gardée ici, et sa ligne dans
 * « Ce qui attend », sont alors la seule trace qu'une famille attend.
 */
class DemandeServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Le socle de « Ce qui attend » doit rester silencieux : sans clés de
        // test, ces deux services lèveraient leur propre ligne.
        config(['paiement.actif' => false, 'push.actif' => false]);

        // Les deux familles ouvertes : c'est le parcours public qu'on éprouve
        // ici. Les tests de fermeture les referment explicitement.
        config([
            'prestations.familles.transport.actif' => true,
            'prestations.familles.restauration.actif' => true,
        ]);
    }

    private function fermer(string ...$familles): void
    {
        foreach ($familles as $f) {
            config(["prestations.familles.{$f}.actif" => false]);
        }
    }

    private function demande(array $surcharges = []): array
    {
        return array_merge([
            'prestation'   => 'transfert_aibd',
            'date_service' => now()->addDays(5)->toDateString(),
            'heure'        => '14:30',
            'personnes'    => 3,
            'lieu'         => 'Villa Teranga, Saly',
            'vol'          => 'AF718',
            'delegation'   => 'Cap-Vert',
            'nom'          => 'Maria Lopes',
            'telephone'    => '+238 991 23 45',
            'langue'       => 'en',
        ], $surcharges);
    }

    /* ── Le catalogue ────────────────────────────────────────────── */

    public function test_le_catalogue_sert_chaque_prestation_dans_les_deux_langues(): void
    {
        $reponse = $this->getJson('/api/prestations')->assertOk();

        $catalogue = $reponse->json('catalogue');
        $this->assertCount(count(config('prestations.catalogue')), $catalogue);

        foreach ($catalogue as $p) {
            $this->assertNotEmpty($p['cle']);
            $this->assertContains($p['famille'], array_keys(config('prestations.familles')));
            $this->assertIsInt($p['prix_a_partir_de']);
            foreach (['libelle', 'unite', 'description'] as $champ) {
                $this->assertNotEmpty($p[$champ]['fr'], "{$p['cle']}.{$champ}.fr");
                $this->assertNotEmpty($p[$champ]['en'], "{$p['cle']}.{$champ}.en");
            }
        }

        $this->assertSame(2, $reponse->json('delai_reponse_heures'));
        $this->assertSame([], $reponse->json('en_apercu'));
    }

    /* ── Les variables : chaque famille s'ouvre seule ────────────── */

    public function test_une_famille_fermee_n_existe_pas_pour_le_public(): void
    {
        $this->fermer('restauration');

        $reponse = $this->getJson('/api/prestations')->assertOk();

        $this->assertSame(['transport'], array_keys($reponse->json('familles')));
        $this->assertSame(['transport'], array_values(array_unique(array_column($reponse->json('catalogue'), 'famille'))));

        // Et on ne peut pas la demander : elle est refusée comme une inconnue.
        $this->postJson('/api/demandes-service', $this->demande(['prestation' => 'panier_repas']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('prestation');
    }

    /**
     * L'aperçu : fermée, une famille reste visible et demandable par
     * l'administration. C'est ce qui permet de tester en production avant
     * d'ouvrir, sans rien montrer au public.
     */
    public function test_l_administration_voit_et_essaie_une_famille_fermee_en_apercu(): void
    {
        $this->fermer('transport', 'restauration');
        $admin = User::factory()->admin()->create();

        $reponse = $this->actingAs($admin, 'sanctum')->getJson('/api/prestations')->assertOk();
        $this->assertEqualsCanonicalizing(['transport', 'restauration'], array_keys($reponse->json('familles')));
        $this->assertEqualsCanonicalizing(['transport', 'restauration'], $reponse->json('en_apercu'));

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/demandes-service', $this->demande())
            ->assertCreated();
    }

    /** Tout fermé, la porte n'existe pas : 404, comme la boutique. */
    public function test_tout_ferme_repond_404_au_public(): void
    {
        $this->fermer('transport', 'restauration');

        $this->getJson('/api/prestations')->assertNotFound();
        $this->postJson('/api/demandes-service', $this->demande())->assertNotFound();
        $this->assertSame(0, DemandeService::count());

        // Un client connecté n'est pas l'administration : pas d'aperçu.
        $client = User::factory()->create();
        $this->actingAs($client, 'sanctum')->getJson('/api/prestations')->assertNotFound();
    }

    public function test_la_configuration_dit_ce_qui_est_ouvert_sans_redeployer(): void
    {
        $this->fermer('restauration');
        config(['joj.actif' => false]);

        $this->getJson('/api/configuration')
            ->assertOk()
            ->assertJsonPath('services.transport', true)
            ->assertJsonPath('services.restauration', false)
            ->assertJsonPath('joj.actif', false);

        config(['joj.actif' => true]);
        $this->getJson('/api/configuration')->assertJsonPath('joj.actif', true);
    }

    public function test_fermes_par_defaut_tant_qu_aucune_variable_ne_les_ouvre(): void
    {
        $config = require config_path('prestations.php');
        foreach ($config['familles'] as $cle => $famille) {
            $this->assertFalse($famille['actif'], "{$cle} doit être fermée par défaut");
        }
        $this->assertFalse((require config_path('joj.php'))['actif']);
    }

    /* ── Déposer une demande ─────────────────────────────────────── */

    public function test_une_demande_sans_compte_est_gardee_et_reçoit_une_reference(): void
    {
        $reponse = $this->postJson('/api/demandes-service', $this->demande())->assertCreated();

        $demande = DemandeService::sole();
        $this->assertSame('S-'.str_pad((string) $demande->id, 4, '0', STR_PAD_LEFT), $reponse->json('reference'));
        $this->assertSame('nouvelle', $demande->fresh()->statut);
        $this->assertNull($demande->user_id);
        $this->assertSame('en', $demande->langue);
        $this->assertSame('AF718', $demande->vol);
        $this->assertNull($demande->origine);
    }

    public function test_l_origine_de_la_demande_est_gardee(): void
    {
        $this->postJson('/api/demandes-service', $this->demande(['origine' => 'joj']))->assertCreated();
        $this->assertSame('joj', DemandeService::sole()->origine);

        $this->postJson('/api/demandes-service', $this->demande(['origine' => 'publicite']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('origine');
    }

    public function test_un_visiteur_connecte_est_rattache_a_sa_demande(): void
    {
        $client = User::factory()->create();

        $this->actingAs($client, 'sanctum')
            ->postJson('/api/demandes-service', $this->demande())
            ->assertCreated();

        $this->assertSame($client->id, DemandeService::sole()->user_id);
    }

    /**
     * Le statut appartient à l'administration. Une demande déposée « déjà
     * traitée » n'apparaîtrait dans aucune file : personne n'y répondrait.
     */
    public function test_le_visiteur_ne_peut_pas_deposer_une_demande_deja_traitee(): void
    {
        $this->postJson('/api/demandes-service', $this->demande([
            'statut' => 'traitee',
            'traitee_le' => now()->toDateTimeString(),
        ]))->assertCreated();

        $demande = DemandeService::sole()->fresh();
        $this->assertSame('nouvelle', $demande->statut);
        $this->assertNull($demande->traitee_le);
    }

    /** « Utiliser ma position actuelle » : le chauffeur sait où prendre la famille. */
    public function test_la_position_donnee_par_le_visiteur_est_gardee(): void
    {
        $this->postJson('/api/demandes-service', $this->demande([
            'latitude' => 14.442186, 'longitude' => -17.000915, 'precision_m' => 25,
        ]))->assertCreated();

        $demande = DemandeService::sole();
        $this->assertSame(14.442186, $demande->latitude);
        $this->assertSame(-17.000915, $demande->longitude);
        $this->assertSame(25, $demande->precision_m);

        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin, 'sanctum')->getJson('/api/admin/demandes-service')
            ->assertOk()
            ->assertJsonPath('data.0.latitude', 14.442186);
    }

    public function test_la_position_reste_facultative(): void
    {
        $this->postJson('/api/demandes-service', $this->demande())->assertCreated();

        $this->assertNull(DemandeService::sole()->latitude);
    }

    /** Une moitié de position ne mène nulle part ; un point hors du globe non plus. */
    public function test_une_position_incomplete_ou_impossible_est_refusee(): void
    {
        $this->postJson('/api/demandes-service', $this->demande(['latitude' => 14.44]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('longitude');

        $this->postJson('/api/demandes-service', $this->demande(['latitude' => 95, 'longitude' => -17]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('latitude');

        $this->assertSame(0, DemandeService::count());
    }

    public function test_une_prestation_hors_catalogue_est_refusee(): void
    {
        $this->postJson('/api/demandes-service', $this->demande(['prestation' => 'jet_prive']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('prestation');

        $this->assertSame(0, DemandeService::count());
    }

    public function test_une_date_passee_est_refusee(): void
    {
        $this->postJson('/api/demandes-service', $this->demande(['date_service' => now()->subDay()->toDateString()]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('date_service');
    }

    public function test_un_numero_trop_court_pour_rappeler_est_refuse(): void
    {
        $this->postJson('/api/demandes-service', $this->demande(['telephone' => '77 12']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('telephone');

        $this->postJson('/api/demandes-service', $this->demande(['telephone' => 'appelez-moi']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('telephone');
    }

    /**
     * Le champ piège : un robot le remplit, un humain ne le voit pas. On lui
     * répond comme à tout le monde — un refus lui apprendrait à l'éviter.
     */
    public function test_le_champ_piege_fait_semblant_d_accepter_sans_rien_garder(): void
    {
        $this->postJson('/api/demandes-service', $this->demande(['site_web' => 'http://spam.example']))
            ->assertCreated();

        $this->assertSame(0, DemandeService::count());
    }

    public function test_le_debit_est_limite_pour_une_porte_publique(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/demandes-service', $this->demande())->assertCreated();
        }

        $this->postJson('/api/demandes-service', $this->demande())->assertStatus(429);
        $this->assertSame(5, DemandeService::count());
    }

    /* ── La console ──────────────────────────────────────────────── */

    public function test_la_liste_est_reservee_a_l_administration(): void
    {
        $this->getJson('/api/admin/demandes-service')->assertUnauthorized();

        $client = User::factory()->create();
        $this->actingAs($client, 'sanctum')->getJson('/api/admin/demandes-service')->assertForbidden();
    }

    public function test_les_demandes_nouvelles_passent_devant_et_la_plus_proche_d_abord(): void
    {
        $admin = User::factory()->admin()->create();

        $lointaine = DemandeService::create($this->demande(['date_service' => now()->addDays(9)->toDateString()]));
        $proche = DemandeService::create($this->demande(['date_service' => now()->addDays(2)->toDateString()]));
        $traitee = DemandeService::create($this->demande(['date_service' => now()->addDay()->toDateString()]));
        $traitee->statut = 'traitee';
        $traitee->save();

        $ids = array_column(
            $this->actingAs($admin, 'sanctum')->getJson('/api/admin/demandes-service')->assertOk()->json('data'),
            'id'
        );

        $this->assertSame([$proche->id, $lointaine->id, $traitee->id], $ids);
    }

    public function test_traiter_une_demande_la_signe_et_la_consigne_au_journal(): void
    {
        $admin = User::factory()->admin()->create();
        $demande = DemandeService::create($this->demande());

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/demandes-service/{$demande->id}", ['statut' => 'traitee'])
            ->assertOk()
            ->assertJsonPath('statut', 'traitee')
            ->assertJsonPath('traitee_par.name', $admin->name);

        $demande->refresh();
        $this->assertNotNull($demande->traitee_le);
        $this->assertSame($admin->id, $demande->traitee_par);
        $this->assertSame(1, JournalAdmin::where('action', 'demande_service.statut')->count());

        // Rouvrir efface la signature : la demande redevient du travail à faire.
        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/demandes-service/{$demande->id}", ['statut' => 'nouvelle'])
            ->assertOk();

        $demande->refresh();
        $this->assertNull($demande->traitee_le);
        $this->assertNull($demande->traitee_par);
    }

    /* ── « Ce qui attend » ───────────────────────────────────────── */

    private function ligneDesDemandes(User $admin): ?array
    {
        $lignes = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/attentes')->assertOk()->json('lignes');

        return collect($lignes)->firstWhere('cle', 'demandes_service');
    }

    public function test_aucune_demande_en_attente_ne_produit_aucune_ligne(): void
    {
        $admin = User::factory()->admin()->create();
        $traitee = DemandeService::create($this->demande());
        $traitee->statut = 'traitee';
        $traitee->save();

        $this->assertNull($this->ligneDesDemandes($admin));
    }

    /**
     * La page promet une réponse sous deux heures. Passé ce délai, ce n'est
     * plus du travail courant : c'est une promesse publiée qu'on ne tient pas.
     */
    public function test_une_demande_sans_reponse_au_dela_du_delai_promis_devient_urgente(): void
    {
        $admin = User::factory()->admin()->create();
        DemandeService::create($this->demande());

        $ligne = $this->ligneDesDemandes($admin);
        $this->assertSame('action', $ligne['gravite']);
        $this->assertSame(1, $ligne['compte']);
        $this->assertSame('/admin/demandes', $ligne['lien']);

        $this->travel(3)->hours();

        $this->assertSame('urgent', $this->ligneDesDemandes($admin)['gravite']);
    }
}
