<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\DevisController;
use App\Http\Controllers\Api\ReglementController;
use App\Models\Devis;
use App\Models\Logement;
use App\Models\Paiement;
use App\Models\Reglement;
use App\Models\Reservation;
use App\Models\Reversement;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use App\Notifications\ReservationAnnuleeParLEquipe;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Ce que devient l'argent qu'un remboursement ne rend pas. PasseTemps le détient : s'il ne
 * figure sur aucun écran, personne ne le verse jamais.
 *
 * Les chiffres sont ceux de l'exemple publié : 100 000 FCFA, 12 000 de commission, 88 000 pour
 * le propriétaire, annulés à trois jours, 44 000 rendus.
 */
class PartApresRemboursementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        $this->admin = User::factory()->create(['role' => 'admin']);
    }

    private function dossier(int $total = 100000, ?int $recu = null, array $villa = []): Paiement
    {
        $v = Villa::factory()->validee()->create();
        $v->forceFill($villa)->save();
        $l = Logement::create(['villa_id' => $v->id, 'nom' => 'Chambre', 'type' => 'chambre', 'capacite' => 4, 'disponible' => true]);
        $t = Tarif::create(['logement_id' => $l->id, 'type_tarif' => 'nuitee', 'prix' => 100000, 'avec_clim' => false, 'avec_buffet' => false]);

        $devis = Devis::etablir('console', [
            'titre' => 'Séjour', 'client_nom' => 'Awa Ndiaye', 'client_telephone' => '+221761112233',
            'villa_id' => $v->id, 'logement_id' => $l->id, 'tarif_id' => $t->id,
            'date_arrivee' => now()->addDays(3)->toDateString(), 'date_depart' => now()->addDays(5)->toDateString(),
            'personnes' => 2, 'valable_jusqu_au' => now()->addDays(2)->toDateString(), 'langue' => 'fr',
        ], [['designation' => 'Location', 'quantite' => 1, 'prix_unitaire' => $total]], $this->admin);

        $this->actingAs($this->admin)->postJson("/api/admin/devis/{$devis->id}/reglements", [
            'montant' => $recu ?? $total, 'moyen' => 'wave', 'recu_le' => now()->toDateString(),
        ])->assertCreated();

        return Paiement::where('reservation_id', $devis->fresh()->reservation_id)->firstOrFail();
    }

    private function rendre(Paiement $p, int $montant, string $imputeA = 'client', bool $commissionRendue = false)
    {
        return $this->actingAs($this->admin)->postJson("/api/admin/reservations/{$p->reservation_id}/remboursement", [
            'montant' => $montant, 'impute_a' => $imputeA, 'commission_rendue' => $commissionRendue,
            'motif' => 'Motif assez long pour être accepté.',
        ])->assertCreated();
    }

    private function sejourPasse(Paiement $p): void
    {
        Reservation::whereKey($p->reservation_id)->update([
            'date_debut' => now()->subDays(5)->toDateString(),
            'date_fin'   => now()->subDay()->toDateString(),
        ]);
    }

    public function test_ce_que_le_bareme_ne_rend_pas_revient_au_proprietaire_apres_la_date_prevue(): void
    {
        $p = $this->dossier();
        $this->assertSame(88000.0, (float) $p->montant_proprietaire);

        $this->rendre($p, 44000);
        $p->refresh();

        $this->assertSame('annulee', $p->reservation->statut);
        $this->assertSame(44000.0, (float) $p->montant_proprietaire);
        $this->assertSame(88000.0, (float) $p->part_avant_remboursement);
        $this->assertSame(12000.0, (float) $p->commission);

        // Pas avant la date prévue : c'est la règle publiée.
        $this->assertSame(0, Paiement::query()->exigible()->count());
        $this->assertSame(44000.0, (float) Paiement::query()->aVenir()->sum('montant_proprietaire'));

        $this->sejourPasse($p);
        $this->assertSame(44000.0, (float) Paiement::query()->exigible()->sum('montant_proprietaire'));
        $this->assertSame(0, Paiement::query()->aVenir()->count());
    }

    public function test_le_versement_verse_ce_qui_reste_et_rien_de_plus(): void
    {
        $p = $this->dossier();
        $this->rendre($p, 44000);
        $this->sejourPasse($p);
        $proprietaire = $p->reservation->logement->villa->proprietaire;

        $this->actingAs($this->admin)->postJson('/api/admin/reversements', [
            'user_id' => $proprietaire->id, 'methode' => 'wave', 'reference' => 'WV-1',
        ])->assertSuccessful();

        $this->assertSame(44000.0, (float) Reversement::firstOrFail()->montant);
        $this->assertSame(0, Paiement::query()->exigible()->count());
    }

    public function test_le_proprietaire_lit_sa_part_dans_ses_revenus(): void
    {
        $p = $this->dossier();
        $this->rendre($p, 44000);
        $proprietaire = $p->reservation->logement->villa->proprietaire;

        $avant = $this->actingAs($proprietaire)->getJson('/api/proprietaire/revenus')->assertOk()->json();
        $this->assertSame(44000.0, (float) $avant['a_venir']);
        $this->assertSame('part_a_venir', $avant['lignes'][0]['etat']);

        $this->sejourPasse($p);
        $apres = $this->actingAs($proprietaire)->getJson('/api/proprietaire/revenus')->json();
        $this->assertSame(44000.0, (float) $apres['du']);
        $this->assertSame('du', $apres['lignes'][0]['etat']);
    }

    public function test_moins_de_48_heures_rien_n_est_rendu_et_tout_lui_revient(): void
    {
        $p = $this->dossier();
        $this->rendre($p, 0);
        $this->sejourPasse($p);

        $this->assertSame(88000.0, (float) Paiement::query()->exigible()->sum('montant_proprietaire'));
    }

    public function test_sept_jours_avant_tout_est_rendu_et_rien_ne_lui_revient(): void
    {
        $p = $this->dossier();
        $this->rendre($p, 88000);
        $this->sejourPasse($p);

        $this->assertSame(0.0, (float) $p->fresh()->montant_proprietaire);
        $this->assertSame(0, Paiement::query()->exigible()->count());
        $this->assertSame(12000.0, (float) $p->fresh()->commission);
    }

    public function test_une_faute_ne_laisse_rien_au_proprietaire_meme_sur_un_remboursement_partiel(): void
    {
        foreach (['proprietaire', 'plateforme'] as $cause) {
            $p = $this->dossier();
            $this->rendre($p, 60000, $cause);
            $this->sejourPasse($p);

            $this->assertNull($p->fresh()->part_avant_remboursement);
            $this->assertSame(0, Paiement::query()->exigible()->whereKey($p->id)->count(), $cause);
            $this->assertSame(0, Paiement::query()->aVenir()->whereKey($p->id)->count(), $cause);
        }
    }

    public function test_un_remboursement_integral_commission_comprise_ne_laisse_rien(): void
    {
        $p = $this->dossier();
        $this->rendre($p, 100000, 'plateforme', true);
        $this->sejourPasse($p);

        $this->assertSame(0, Paiement::query()->exigible()->count());
    }

    public function test_un_second_remboursement_repart_de_la_part_d_origine(): void
    {
        $p = $this->dossier();
        $this->rendre($p, 44000);
        $this->rendre($p, 10000);

        $p->refresh();
        $this->assertSame(34000.0, (float) $p->montant_proprietaire);
        $this->assertSame(88000.0, (float) $p->part_avant_remboursement);
        $this->assertSame(54000.0, (float) $p->rendu_au_client);

        // La cause change : plus rien ne lui revient.
        $this->rendre($p, 10000, 'proprietaire');
        $this->sejourPasse($p);
        $this->assertSame(0.0, (float) $p->fresh()->montant_proprietaire);
        $this->assertSame(0, Paiement::query()->exigible()->count());
    }

    public function test_un_proprietaire_deja_paye_ne_change_rien_et_doit_ce_qui_est_rendu(): void
    {
        $p = $this->dossier();
        $reversement = new Reversement(['montant' => 88000, 'methode' => 'wave', 'statut' => 'manuel']);
        $reversement->forceFill(['user_id' => $p->reservation->logement->villa->user_id, 'beneficiaire_nom' => 'Propriétaire', 'createur_nom' => 'Équipe'])->save();
        $p->forceFill(['reversement_id' => $reversement->id])->save();

        $this->rendre($p, 44000)->assertJsonPath('a_recuperer_proprietaire', '44000.00');

        $p->refresh();
        $this->assertSame(88000.0, (float) $p->montant_proprietaire);
        $this->assertNull($p->part_avant_remboursement);
    }

    public function test_un_acompte_garde_sa_part_et_le_solde_ne_retient_plus_rien(): void
    {
        $p = $this->dossier(200000, 50000);
        $this->assertGreaterThan(0, (float) $p->solde);
        $part = (float) $p->montant_proprietaire;

        $this->rendre($p, 20000);
        $this->sejourPasse($p);

        $p->refresh();
        $this->assertSame(0.0, (float) $p->solde);
        $this->assertSame($part - 20000, (float) $p->montant_proprietaire);
        $this->assertSame($part - 20000, (float) Paiement::query()->exigible()->sum('montant_proprietaire'));
        $this->assertSame(0, Paiement::query()->soldeOuvert()->count());
        $this->assertSame(0, Paiement::query()->retenuFauteDeSolde()->count());
    }

    public function test_les_associes_recoivent_ce_qui_reste_sauf_notre_part(): void
    {
        $p = $this->dossier(114000, null, ['circuit' => 'associe', 'majoration' => 0.14]);
        $this->assertSame(14000.0, (float) $p->commission);
        $notre = (float) $p->part_passetemps;

        $this->assertSame(1, Paiement::query()->aTransmettre()->count());
        $this->rendre($p, 50000);

        $p->refresh();
        $this->assertSame(1, Paiement::query()->aTransmettre()->whereKey($p->id)->count());
        $this->assertSame((int) (114000 - $notre - 50000), $p->aTransmettre());

        $ligne = collect($this->actingAs($this->admin)->getJson('/api/admin/transmissions')->assertOk()->json('a_transmettre'))->firstWhere('id', $p->id);
        $this->assertSame(50000, $ligne['rendu_au_client']);

        // Le propriétaire passe par eux : rien ne s'additionne à ce qu'on lui verse.
        $this->assertSame(0, Paiement::query()->exigible()->count());
        $this->assertSame(0, Paiement::query()->aVenir()->count());
    }

    public function test_tout_rendu_sur_sa_part_les_associes_gardent_leur_part_de_commission(): void
    {
        $p = $this->dossier(114000, null, ['circuit' => 'associe', 'majoration' => 0.14]);
        $notre = (float) $p->part_passetemps;

        $this->rendre($p, 100000);

        $this->assertSame((int) (14000 - $notre), $p->fresh()->aTransmettre());
        $this->assertSame(1, Paiement::query()->aTransmettre()->count());
    }

    public function test_une_faute_ne_laisse_rien_a_transmettre(): void
    {
        $p = $this->dossier(114000, null, ['circuit' => 'associe', 'majoration' => 0.14]);
        $this->rendre($p, 114000, 'plateforme', true);

        $this->assertSame(0, Paiement::query()->aTransmettre()->count());
    }

    public function test_de_l_argent_deja_transmis_aux_associes_est_a_reclamer(): void
    {
        $p = $this->dossier(114000, null, ['circuit' => 'associe', 'majoration' => 0.14]);
        $p->forceFill(['transmis_le' => now(), 'transmis_montant' => $p->aTransmettre()])->save();

        $proposition = $this->actingAs($this->admin)->getJson("/api/admin/reservations/{$p->reservation_id}/remboursement?impute_a=client")->assertOk()->json();
        $this->assertTrue($proposition['proprietaire_deja_paye']);
        $this->assertStringContainsString('associés', $proposition['avertissement']);

        $this->rendre($p, 50000)->assertJsonPath('a_recuperer_proprietaire', '50000.00');
        $this->assertSame(0, Paiement::query()->aTransmettre()->count());
    }

    public function test_le_courrier_dit_qu_une_part_reste_due_et_seulement_alors(): void
    {
        $garde = $this->dossier();
        $this->rendre($garde, 44000);
        $proprietaire = $garde->reservation->logement->villa->proprietaire;

        $texte = fn (Reservation $r, User $u) => implode(' ', array_map('strval', (new ReservationAnnuleeParLEquipe($r))->toMail($u)->introLines));

        $this->assertStringContainsString('vous reste due', $texte($garde->fresh()->reservation, $proprietaire));

        $tout = $this->dossier();
        $this->rendre($tout, 88000);
        $this->assertStringNotContainsString('vous reste due', $texte($tout->fresh()->reservation, $tout->reservation->logement->villa->proprietaire));
    }

    public function test_le_devis_et_le_recu_disent_le_solde_avant_l_arrivee_et_tiennent_sur_une_page(): void
    {
        $this->assertStringContainsString('avant l’arrivée', config('devis.conditions.site'));
        $this->assertStringContainsString('before arrival', config('devis.conditions.site_en'));

        $pages = fn (string $pdf) => preg_match_all('#/Type\s*/Page[^s]#', $pdf);

        foreach (['fr' => 'avant l’arrivée', 'en' => 'before arrival'] as $langue => $phrase) {
            // Le cas le plus long qu'on a vu : plusieurs prestations avec leur détail.
            $reponse = $this->actingAs($this->admin)->postJson('/api/admin/devis', [
                'titre' => 'Séjour', 'client_nom' => 'FAN MILK S/C LDB', 'occupant_nom' => 'Mansour Sow', 'langue' => $langue,
                'lignes' => array_fill(0, 3, ['designation' => 'Location · Chambre climatisée', 'detail' => 'Nuitée, avec clim', 'quantite' => 2, 'unite' => 'nuitée', 'prix_unitaire' => 25000]),
            ])->assertCreated();

            $devis = Devis::findOrFail($reponse->json('id'));
            $html = view('pdf.devis', DevisController::donnees($devis))->render();
            $this->assertStringContainsString($phrase, html_entity_decode($html, ENT_QUOTES));
            $this->assertSame(1, $pages(DevisController::rendre($devis)), "devis {$langue}");
        }

        $p = $this->dossier(200000, 50000);
        $recu = Reglement::where('reservation_id', $p->reservation_id)->firstOrFail();
        $this->assertStringContainsString('avant votre arrivée', html_entity_decode(view('pdf.recu', ReglementController::donnees($recu))->render(), ENT_QUOTES));
        $this->assertSame(1, $pages(ReglementController::rendre($recu)));

        // Soldé, il n'y a plus rien à dire du solde.
        $solde = $this->dossier(50000);
        $complet = Reglement::where('reservation_id', $solde->reservation_id)->firstOrFail();
        $this->assertStringNotContainsString('avant votre arrivée', html_entity_decode(view('pdf.recu', ReglementController::donnees($complet))->render(), ENT_QUOTES));
    }
}
