<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Paiement;
use App\Models\Reservation;
use App\Models\Reversement;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Le reversement de la part du propriétaire.
 *
 * Rien ici ne déplace de fonds : la plateforme encaisse tout sur son compte
 * PayDunya et vire ensuite à la main. Ces tests fixent la seule chose que le
 * code décide — **combien** est dû, **quand** ça le devient, et que la somme
 * ne puisse jamais être dictée par la requête.
 */
class ReversementTest extends TestCase
{
    use RefreshDatabase;

    private User $proprietaire;

    protected function setUp(): void
    {
        parent::setUp();
        $this->proprietaire = User::factory()->proprietaire()->create(['phone' => '+221 77 123 45 67']);
    }

    /**
     * Un séjour payé. `$finDansLePasse` décide s'il est terminé — donc si la
     * part est exigible ou seulement à venir.
     */
    private function sejourPaye(int $montant, bool $termine, string $statut = 'confirmee'): Paiement
    {
        $villa = Villa::factory()->validee()->create(['user_id' => $this->proprietaire->id]);
        $logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'villa_entiere',
            'capacite' => 4, 'disponible' => true,
        ]);
        $tarif = Tarif::create([
            'logement_id' => $logement->id, 'type_tarif' => 'nuitee',
            'prix' => $montant, 'avec_clim' => false, 'avec_buffet' => false,
        ]);

        $reservation = Reservation::create([
            'user_id' => User::factory()->client()->create()->id,
            'logement_id' => $logement->id,
            'tarif_id' => $tarif->id,
            'date_debut' => $termine ? now()->subDays(6)->toDateString() : now()->addDays(4)->toDateString(),
            'date_fin' => $termine ? now()->subDays(2)->toDateString() : now()->addDays(8)->toDateString(),
            'nb_personnes' => 2,
            'montant_total' => $montant,
            'statut' => $statut,
        ]);

        // La répartition est figée à l'encaissement, exactement comme en vrai :
        // c'est `Commission::pour()` qui décide du taux, pas le test.
        $paiement = new Paiement([
            'reservation_id' => $reservation->id,
            'methode' => 'wave',
            'statut' => 'reussi',
            'paye_le' => now(),
        ]);
        $paiement->appliquerRepartition(\App\Services\Commission::pour($montant));
        $paiement->save();

        return $paiement->refresh();
    }

    /* ── Ce qui est dû, et quand ─────────────────────────────────── */

    /**
     * Le point central : un séjour payé mais **pas encore terminé** n'est pas
     * exigible. Verser d'avance, c'est devoir réclamer un remboursement à un
     * propriétaire qui a déjà dépensé l'argent si le séjour tombe.
     */
    public function test_un_sejour_a_venir_n_est_pas_exigible(): void
    {
        $this->sejourPaye(100000, termine: false);

        $reponse = $this->actingAs($this->proprietaire, 'sanctum')->getJson('/api/proprietaire/revenus');

        $reponse->assertOk();
        $this->assertSame(0.0, (float) $reponse->json('du'));
        $this->assertSame(80000.0, (float) $reponse->json('a_venir'), '100 000 FCFA à 20 % laissent 80 000.');
    }

    public function test_un_sejour_termine_devient_exigible(): void
    {
        $this->sejourPaye(100000, termine: true);

        $reponse = $this->actingAs($this->proprietaire, 'sanctum')->getJson('/api/proprietaire/revenus');

        $this->assertSame(80000.0, (float) $reponse->json('du'));
        $this->assertSame(0.0, (float) $reponse->json('a_venir'));
        $this->assertSame(20000.0, (float) $reponse->json('commission_retenue'));
    }

    /** Une réservation annulée ne doit rien : le remboursement est un autre sujet. */
    public function test_un_sejour_annule_n_est_pas_du(): void
    {
        $this->sejourPaye(100000, termine: true, statut: 'annulee');

        $reponse = $this->actingAs($this->proprietaire, 'sanctum')->getJson('/api/proprietaire/revenus');

        $this->assertSame(0.0, (float) $reponse->json('du'));
        $this->assertSame(0.0, (float) $reponse->json('a_venir'));
    }

    /** Un paiement qui n'a jamais abouti n'est pas de l'argent. */
    public function test_un_paiement_en_attente_ne_compte_pas(): void
    {
        $paiement = $this->sejourPaye(100000, termine: true);
        $paiement->update(['statut' => 'en_attente', 'paye_le' => null]);

        $reponse = $this->actingAs($this->proprietaire, 'sanctum')->getJson('/api/proprietaire/revenus');

        $this->assertSame(0.0, (float) $reponse->json('du'));
    }

    /** Le taux réduit s'applique sous le seuil : 10 % au lieu de 20 %. */
    public function test_le_taux_reduit_s_applique_sous_le_seuil(): void
    {
        $this->sejourPaye(40000, termine: true);

        $reponse = $this->actingAs($this->proprietaire, 'sanctum')->getJson('/api/proprietaire/revenus');

        $this->assertSame(36000.0, (float) $reponse->json('du'));
    }

    /* ── Cloisonnement ───────────────────────────────────────────── */

    public function test_un_proprietaire_ne_voit_que_ses_propres_revenus(): void
    {
        $this->sejourPaye(100000, termine: true);
        $autre = User::factory()->proprietaire()->create();

        $reponse = $this->actingAs($autre, 'sanctum')->getJson('/api/proprietaire/revenus');

        $this->assertSame(0.0, (float) $reponse->json('du'));
        $this->assertCount(0, $reponse->json('lignes'));
    }

    public function test_un_client_n_a_pas_de_revenus(): void
    {
        $this->actingAs(User::factory()->client()->create(), 'sanctum')
             ->getJson('/api/proprietaire/revenus')
             ->assertStatus(403);
    }

    public function test_un_visiteur_est_refuse(): void
    {
        $this->getJson('/api/proprietaire/revenus')->assertStatus(401);
    }

    /* ── L'enregistrement du versement ───────────────────────────── */

    public function test_l_admin_enregistre_un_versement_et_solde_les_paiements(): void
    {
        $paiement = $this->sejourPaye(100000, termine: true);
        $admin = User::factory()->admin()->create();

        $reponse = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/reversements', [
            'user_id' => $this->proprietaire->id,
            'methode' => 'wave',
            'reference' => 'TX-2026-0001',
        ]);

        $reponse->assertStatus(201);
        $this->assertSame('80000.00', $reponse->json('montant'));

        // Le paiement est rattaché, donc plus jamais exigible.
        $this->assertNotNull($paiement->refresh()->reversement_id);
        $this->assertSame(
            0.0,
            (float) $this->actingAs($this->proprietaire, 'sanctum')->getJson('/api/proprietaire/revenus')->json('du')
        );
    }

    /**
     * Le montant est calculé par le serveur. Un champ de somme accepté depuis
     * la requête, c'est une écriture comptable dictée par le navigateur.
     */
    public function test_le_montant_envoye_dans_la_requete_est_ignore(): void
    {
        $this->sejourPaye(100000, termine: true);
        $admin = User::factory()->admin()->create();

        $reponse = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/reversements', [
            'user_id' => $this->proprietaire->id,
            'methode' => 'wave',
            'montant' => 5_000_000,
        ]);

        $this->assertSame('80000.00', $reponse->json('montant'));
    }

    /** Deux enregistrements de suite ne doivent pas payer deux fois. */
    public function test_un_second_versement_immediat_est_refuse(): void
    {
        $this->sejourPaye(100000, termine: true);
        $admin = User::factory()->admin()->create();

        $requete = fn () => $this->actingAs($admin, 'sanctum')->postJson('/api/admin/reversements', [
            'user_id' => $this->proprietaire->id,
            'methode' => 'wave',
        ]);

        $requete()->assertStatus(201);
        $requete()->assertStatus(422);

        $this->assertSame(1, Reversement::count());
        $this->assertSame('80000.00', Reversement::first()->montant);
    }

    /** Ce qui n'est pas encore exigible ne part pas avec le versement. */
    public function test_le_versement_ne_solde_pas_les_sejours_a_venir(): void
    {
        $this->sejourPaye(100000, termine: true);
        $aVenir = $this->sejourPaye(200000, termine: false);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/reversements', [
            'user_id' => $this->proprietaire->id, 'methode' => 'orange_money',
        ])->assertStatus(201);

        $this->assertNull($aVenir->refresh()->reversement_id);
        $this->assertSame(
            160000.0,
            (float) $this->actingAs($this->proprietaire, 'sanctum')->getJson('/api/proprietaire/revenus')->json('a_venir')
        );
    }

    public function test_un_non_admin_ne_peut_pas_enregistrer_un_versement(): void
    {
        $this->sejourPaye(100000, termine: true);

        $this->actingAs($this->proprietaire, 'sanctum')
             ->postJson('/api/admin/reversements', ['user_id' => $this->proprietaire->id, 'methode' => 'wave'])
             ->assertStatus(403);

        $this->assertSame(0, Reversement::count());
    }

    public function test_un_versement_a_un_client_est_refuse(): void
    {
        $client = User::factory()->client()->create();
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/admin/reversements', ['user_id' => $client->id, 'methode' => 'wave'])
             ->assertStatus(422);
    }

    public function test_une_methode_inconnue_est_refusee(): void
    {
        $this->sejourPaye(100000, termine: true);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
             ->postJson('/api/admin/reversements', [
                 'user_id' => $this->proprietaire->id, 'methode' => 'bitcoin',
             ])
             ->assertStatus(422);
    }

    /* ── La file d'attente de l'admin ────────────────────────────── */

    public function test_la_file_liste_les_proprietaires_qui_attendent(): void
    {
        $this->sejourPaye(100000, termine: true);
        $admin = User::factory()->admin()->create();

        $reponse = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reversements');

        $reponse->assertOk();
        $this->assertSame(80000.0, (float) $reponse->json('total_du'));
        $this->assertSame($this->proprietaire->name, $reponse->json('proprietaires.0.nom'));
        $this->assertSame(80000.0, (float) $reponse->json('proprietaires.0.du'));
    }

    /** Un propriétaire sans un franc en jeu n'encombre pas la file. */
    public function test_la_file_ignore_les_proprietaires_sans_enjeu(): void
    {
        User::factory()->proprietaire()->create();
        $admin = User::factory()->admin()->create();

        $reponse = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reversements');

        $this->assertCount(0, $reponse->json('proprietaires'));
    }

    /**
     * La trace survit à la suppression du bénéficiaire : le nom est recopié,
     * pas seulement relié. Une écriture comptable qui disparaît avec son
     * destinataire ne prouve rien le jour d'un litige.
     */
    public function test_le_versement_survit_a_la_suppression_du_beneficiaire(): void
    {
        $this->sejourPaye(100000, termine: true);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/reversements', [
            'user_id' => $this->proprietaire->id, 'methode' => 'wave',
        ])->assertStatus(201);

        $nom = $this->proprietaire->name;
        $this->proprietaire->delete();

        $reversement = Reversement::first();
        $this->assertNotNull($reversement, 'Le versement ne doit pas partir avec son bénéficiaire.');
        $this->assertNull($reversement->user_id);
        $this->assertSame($nom, $reversement->beneficiaire_nom);
        $this->assertSame('80000.00', $reversement->montant);
    }

    /** Un versement se retrouve dans le journal d'audit. */
    public function test_le_versement_est_consigne(): void
    {
        $this->sejourPaye(100000, termine: true);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/reversements', [
            'user_id' => $this->proprietaire->id, 'methode' => 'wave',
        ]);

        $this->assertDatabaseHas('journal_admin', [
            'action' => 'reversement.enregistre',
            'cible_libelle' => $this->proprietaire->name,
        ]);
    }
}
