<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Paiement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use App\Services\Commission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Ce qu'on peut retirer de PayDunya. L'exploitant n'a qu'un compte personnel : ce chiffre est
 * la seule chose qui sépare son argent de celui des propriétaires.
 */
class SoldePaydunyaTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
        config([
            'paiement.paydunya.mode' => 'test',
            'paiement.paydunya.cle_maitre' => 'cle-maitresse-de-test',
            'paiement.paydunya.cle_privee' => 'test_private_abc',
            'paiement.paydunya.cle_publique' => 'test_public_abc',
            'paiement.paydunya.token' => 'jeton-de-test',
        ]);
    }

    private function solde(string $montant): void
    {
        Http::fake(['*disburse/check-balance*' => Http::response([
            'success' => true,
            'description' => 'Le solde envoyé par l’API est une approximation.',
            'Balance SN' => $montant.' XOF',
            'Balance CI' => '0.00 XOF',
        ])]);
    }

    /** Un paiement du site, réussi, sur un séjour à venir. */
    private function paiement(int $montant = 100000, array $enPlus = [], array $villa = []): Paiement
    {
        $v = Villa::factory()->validee()->create();
        $v->forceFill($villa)->save();
        $l = Logement::create(['villa_id' => $v->id, 'nom' => 'Chambre', 'type' => 'chambre', 'capacite' => 2, 'disponible' => true]);
        $t = Tarif::create(['logement_id' => $l->id, 'type_tarif' => 'nuitee', 'prix' => $montant, 'avec_clim' => false, 'avec_buffet' => false]);
        $r = Reservation::create([
            'user_id' => User::factory()->create()->id, 'logement_id' => $l->id, 'tarif_id' => $t->id,
            'date_debut' => now()->addDays(10)->toDateString(), 'date_fin' => now()->addDays(11)->toDateString(),
            'nb_personnes' => 1, 'montant_total' => $montant, 'statut' => 'confirmee',
        ]);
        $p = new Paiement(['reservation_id' => $r->id, 'methode' => 'wave', 'statut' => 'reussi', 'paye_le' => now()]);
        $p->appliquerRepartition(Commission::pour($montant, $villa['majoration'] ?? null), $villa['circuit'] ?? 'direct');
        $p->forceFill($enPlus)->save();

        return $p;
    }

    private function lire(array $params = [])
    {
        return $this->actingAs($this->admin)->getJson('/api/admin/fonds/paydunya'.($params ? '?'.http_build_query($params) : ''))->assertOk();
    }

    public function test_on_peut_retirer_ce_qui_depasse_la_part_des_proprietaires(): void
    {
        $this->paiement();
        $this->solde('150000.00');

        $this->lire()
            ->assertJsonPath('lu', true)
            ->assertJsonPath('solde', 150000)
            ->assertJsonPath('a_garder.proprietaires', 88000)
            ->assertJsonPath('a_garder.total', 88000)
            ->assertJsonPath('retirable', 62000)
            ->assertJsonPath('manque', 0)
            ->assertJsonPath('compte_test', true);
    }

    public function test_le_manque_se_dit_quand_le_compte_ne_couvre_pas_ce_qui_est_du(): void
    {
        $this->paiement();
        $this->solde('80000.00');

        $this->lire()->assertJsonPath('retirable', 0)->assertJsonPath('manque', 8000);
    }

    public function test_l_argent_recu_a_la_main_ne_compte_pas_dans_paydunya(): void
    {
        $this->paiement(100000, ['hors_ligne' => true, 'methode' => 'hors_ligne']);
        $this->solde('5000.00');

        $this->lire()
            ->assertJsonPath('a_garder.total', 0)
            ->assertJsonPath('retirable', 5000)
            ->assertJsonPath('hors_ligne.proprietaires', 88000)
            ->assertJsonPath('hors_ligne.total', 88000);
    }

    public function test_un_remboursement_a_decider_se_garde_en_entier_sans_double_compte(): void
    {
        $p = $this->paiement();
        Reservation::whereKey($p->reservation_id)->update(['annulation_demandee_le' => now(), 'annulation_motif' => 'Vol annulé.']);
        $this->solde('100000.00');

        $this->lire()
            ->assertJsonPath('a_garder.proprietaires', 0)
            ->assertJsonPath('a_garder.remboursements', 100000)
            ->assertJsonPath('retirable', 0);
    }

    public function test_la_part_des_associes_reste_aussi(): void
    {
        $p = $this->paiement(114000, [], ['circuit' => 'associe', 'majoration' => 0.14]);
        $this->solde('114000.00');

        $this->lire()
            ->assertJsonPath('a_garder.associes', $p->aTransmettre())
            ->assertJsonPath('a_garder.proprietaires', 0)
            ->assertJsonPath('retirable', 114000 - $p->aTransmettre());
    }

    public function test_une_erreur_de_paydunya_n_empeche_pas_de_dire_ce_qu_il_faut_laisser(): void
    {
        $this->paiement();
        Http::fake(['*disburse/check-balance*' => Http::response(['success' => false, 'message' => 'Account user not found'], 200)]);

        $this->lire()
            ->assertJsonPath('lu', false)
            ->assertJsonPath('solde', null)
            ->assertJsonPath('retirable', null)
            ->assertJsonPath('message', 'PayDunya répond : Account user not found')
            ->assertJsonPath('a_garder.total', 88000);
    }

    public function test_sans_cles_on_n_appelle_personne(): void
    {
        config(['paiement.paydunya.cle_maitre' => null, 'paiement.paydunya.cle_privee' => null, 'paiement.paydunya.token' => null]);
        Http::fake();

        $this->lire()->assertJsonPath('configure', false)->assertJsonPath('lu', false);
        Http::assertNothingSent();
    }

    public function test_le_solde_se_garde_deux_minutes_sauf_si_on_demande_a_le_relire(): void
    {
        $this->solde('150000.00');

        $this->lire();
        $this->lire();
        Http::assertSentCount(1);

        $this->lire(['rafraichir' => 1]);
        Http::assertSentCount(2);
    }

    public function test_seule_l_equipe_le_voit(): void
    {
        $this->getJson('/api/admin/fonds/paydunya')->assertUnauthorized();
        $this->actingAs(User::factory()->proprietaire()->create())->getJson('/api/admin/fonds/paydunya')->assertForbidden();
    }
}
