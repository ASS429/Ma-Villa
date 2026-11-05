<?php

namespace Tests\Feature;

use App\Models\Devis;
use App\Models\JournalAdmin;
use App\Models\Logement;
use App\Models\Paiement;
use App\Models\Reglement;
use App\Models\Remboursement;
use App\Models\Reservation;
use App\Models\Reversement;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use App\Notifications\ReservationAnnuleeParLEquipe;
use App\Notifications\ReservationConfirmeeParLEquipe;
use App\Services\Commission;
use App\Services\FichierClients;
use App\Services\Pilotage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * L'argent reçu hors du site. PasseTemps le détient, et en doit une part au propriétaire :
 * chaque test ici est une façon concrète de se tromper d'argent ou de dates.
 */
class EncaissementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        $this->admin = User::factory()->create(['role' => 'admin', 'name' => 'Équipe PasseTemps']);
    }

    /** @return array{0: Villa, 1: Logement, 2: Tarif} */
    private function annonce(array $villa = []): array
    {
        $v = Villa::factory()->validee()->create($villa + ['nom' => 'Résidence Kabrousse', 'ville' => 'Saly']);
        $l = Logement::create([
            'villa_id' => $v->id, 'nom' => 'Chambre', 'type' => 'chambre', 'capacite' => 4, 'disponible' => true,
        ]);
        $t = Tarif::create([
            'logement_id' => $l->id, 'type_tarif' => 'nuitee', 'prix' => 100000, 'avec_clim' => false, 'avec_buffet' => false,
        ]);

        return [$v, $l, $t];
    }

    private function devis(int $total = 200000, array $attributs = [], ?array $annonce = null): Devis
    {
        [$v, $l, $t] = $annonce ?? $this->annonce();

        return Devis::etablir('console', $attributs + [
            'titre'            => 'Séjour à Saly',
            'client_nom'       => 'Awa Ndiaye',
            'client_telephone' => '+221761112233',
            'client_email'     => 'awa@exemple.sn',
            'villa_id'         => $v->id,
            'logement_id'      => $l->id,
            'tarif_id'         => $t->id,
            'date_arrivee'     => now()->addDays(10)->toDateString(),
            'date_depart'      => now()->addDays(12)->toDateString(),
            'personnes'        => 2,
            'valable_jusqu_au' => now()->addDays(7)->toDateString(),
            'langue'           => 'fr',
        ], [['designation' => 'Location', 'quantite' => 1, 'prix_unitaire' => $total]], $this->admin);
    }

    private function encaisser(Devis $devis, int $montant, array $enPlus = [])
    {
        return $this->actingAs($this->admin)->postJson("/api/admin/devis/{$devis->id}/reglements", $enPlus + [
            'montant' => $montant,
            'moyen'   => 'wave',
            'recu_le' => now()->toDateString(),
        ]);
    }

    /* ── Le premier argent bloque les dates ───────────────────── */

    public function test_le_premier_reglement_bloque_les_dates_sans_creer_de_compte(): void
    {
        $devis = $this->devis();
        $comptes = User::count();

        $this->encaisser($devis, 50000)->assertCreated()->assertJsonPath('numero', 'RC-'.now()->year.'-0001');

        $this->assertSame($comptes, User::count());
        $devis->refresh();
        $this->assertSame('accepte', $devis->statut);

        $reservation = Reservation::findOrFail($devis->reservation_id);
        $this->assertNull($reservation->user_id);
        $this->assertSame('confirmee', $reservation->statut);
        $this->assertSame('Awa Ndiaye', $reservation->client->name);
        $this->assertFalse($reservation->client->exists);
        $this->assertSame(200000.0, (float) $reservation->montant_total);

        // Le calendrier le voit : un autre client ne peut plus demander ces dates.
        $this->assertTrue(Reservation::where('logement_id', $devis->logement_id)->bloquante()
            ->chevauchant($devis->date_arrivee->toDateString(), $devis->date_depart->toDateString())->exists());
    }

    public function test_le_proprietaire_est_prevenu_une_seule_fois_par_courrier(): void
    {
        $devis = $this->devis();
        $proprietaire = $devis->villa->proprietaire;

        $this->encaisser($devis, 50000)->assertCreated();
        $this->encaisser($devis, 50000, ['moyen' => 'especes'])->assertCreated();

        Notification::assertSentToTimes($proprietaire, ReservationConfirmeeParLEquipe::class, 1);
    }

    public function test_le_courrier_du_proprietaire_supporte_la_file_et_ne_parle_pas_d_argent(): void
    {
        $devis = $this->devis();
        $this->encaisser($devis, 50000)->assertCreated();
        $proprietaire = $devis->villa->proprietaire;

        Notification::assertSentTo($proprietaire, ReservationConfirmeeParLEquipe::class, function ($notification) use ($proprietaire) {
            // Une notification en file est sérialisée, avec le client sans compte chargé dedans.
            $relue = unserialize(serialize($notification));
            $texte = implode(' ', array_map('strval', $relue->toMail($proprietaire)->introLines));

            $this->assertStringContainsString('Awa Ndiaye', $texte);
            $this->assertStringContainsString('+221761112233', $texte);
            $this->assertStringNotContainsString('FCFA', $texte);

            return true;
        });
    }

    public function test_le_proprietaire_apprend_que_les_dates_sont_rendues(): void
    {
        $devis = $this->devis();
        $this->encaisser($devis, 50000)->assertCreated();
        $proprietaire = $devis->villa->proprietaire;

        $this->actingAs($this->admin)->postJson('/api/admin/reglements/'.Reglement::firstOrFail()->id.'/annuler', ['motif' => 'Somme saisie par erreur.'])->assertOk();

        Notification::assertSentToTimes($proprietaire, ReservationAnnuleeParLEquipe::class, 1);
    }

    public function test_le_proprietaire_apprend_le_remboursement(): void
    {
        $devis = $this->devis(100000);
        $this->encaisser($devis, 100000)->assertCreated();
        $reservation = $devis->fresh()->reservation;

        $this->actingAs($this->admin)->postJson("/api/admin/reservations/{$reservation->id}/remboursement", [
            'montant' => 100000, 'impute_a' => 'plateforme', 'motif' => 'Le propriétaire n’a pas pu accueillir.',
        ])->assertSuccessful();

        Notification::assertSentToTimes($devis->villa->proprietaire, ReservationAnnuleeParLEquipe::class, 1);
    }

    public function test_des_dates_deja_prises_refusent_le_reglement_sans_rien_ecrire(): void
    {
        $annonce = $this->annonce();
        $premier = $this->devis(annonce: $annonce);
        $second = $this->devis(annonce: $annonce);

        $this->encaisser($premier, 50000)->assertCreated();
        $this->encaisser($second, 50000)->assertStatus(409)->assertJsonFragment(['message' => 'Ces dates sont déjà prises sur ce logement : aucun règlement n’a été enregistré. Changez les dates ou le logement du devis, ou rendez l’argent au client.']);

        $this->assertSame(1, Reglement::count());
        $this->assertNull($second->fresh()->reservation_id);
    }

    public function test_une_periode_fermee_par_le_proprietaire_refuse_le_reglement(): void
    {
        $annonce = $this->annonce();
        $annonce[1]->disponibilites()->create([
            'date_debut' => now()->addDays(11)->toDateString(),
            'date_fin'   => now()->addDays(20)->toDateString(),
            'disponible' => false,
        ]);

        $this->encaisser($this->devis(annonce: $annonce), 50000)->assertStatus(409);
        $this->assertSame(0, Reglement::count());
    }

    public function test_un_devis_incomplet_dit_ce_qui_manque(): void
    {
        $devis = $this->devis(attributs: ['date_arrivee' => null, 'date_depart' => null]);

        $this->encaisser($devis, 50000)->assertStatus(422)->assertJsonFragment([
            'message' => 'Avant d’encaisser, ce devis doit indiquer les dates du séjour : sans cela, on ne sait ni quel séjour bloquer, ni à qui reverser.',
        ]);
    }

    /* ── Les montants ─────────────────────────────────────────── */

    public function test_le_montant_ne_depasse_jamais_ce_qui_reste_a_payer(): void
    {
        $devis = $this->devis(100000);

        $this->encaisser($devis, 150000)->assertStatus(422);
        $this->encaisser($devis, 60000)->assertCreated();
        $this->encaisser($devis, 60000)->assertStatus(422);
        $this->encaisser($devis, 40000, ['recu_le' => now()->subDay()->toDateString()])->assertCreated();
        $this->encaisser($devis, 1)->assertStatus(409);
    }

    public function test_le_tout_retombe_exactement_sur_le_bareme(): void
    {
        foreach ([[120000], [33333, 33334, 53333], [1, 119999], [40000, 40000, 40000]] as $i => $sommes) {
            $devis = $this->devis(120000, ['date_arrivee' => now()->addDays(10 + $i)->toDateString(), 'date_depart' => now()->addDays(11 + $i)->toDateString()]);
            foreach ($sommes as $j => $somme) {
                $this->encaisser($devis, $somme, ['recu_le' => now()->subDays($j)->toDateString()])->assertCreated();
            }

            $p = Paiement::where('reservation_id', $devis->fresh()->reservation_id)->firstOrFail();
            $attendu = Commission::pour(120000);

            $this->assertSame((float) $attendu->commission, (float) $p->commission, implode('+', $sommes));
            $this->assertSame((float) $attendu->montantProprietaire, (float) $p->montant_proprietaire);
            $this->assertSame(0.0, (float) $p->solde);
            $this->assertSame('hors_ligne', $p->methode);
            $this->assertSame('reussi', $p->statut);
            $this->assertTrue($p->hors_ligne);
        }
    }

    public function test_un_acompte_prend_sa_part_de_commission_et_garde_le_solde(): void
    {
        $devis = $this->devis(200000);
        $this->encaisser($devis, 50000)->assertCreated();

        $p = Paiement::firstOrFail();
        $attendu = Commission::pour(200000);

        $this->assertSame(50000.0, (float) $p->montant);
        $this->assertSame((float) floor($attendu->commission / 4), (float) $p->commission);
        $this->assertSame(50000.0 - (float) $p->commission, (float) $p->montant_proprietaire);
        $this->assertSame(150000.0, (float) $p->solde);
    }

    public function test_le_circuit_des_associes_se_fige_et_retrouve_le_prix_du_proprietaire(): void
    {
        $annonce = $this->annonce();
        $annonce[0]->forceFill(['circuit' => 'associe', 'majoration' => 0.14])->save();
        $devis = $this->devis(114000, annonce: $annonce);

        $this->encaisser($devis, 14000)->assertCreated();
        $this->assertSame('associe', Paiement::firstOrFail()->circuit);

        // Changer l'annonce en cours de dossier ne change pas à qui part l'argent.
        $annonce[0]->forceFill(['circuit' => 'direct', 'majoration' => null])->save();
        $this->encaisser($devis, 100000, ['moyen' => 'especes'])->assertCreated();

        $p = Paiement::firstOrFail();
        $this->assertSame('associe', $p->circuit);
        $this->assertSame(100000.0, (float) $p->montant_proprietaire);
        $this->assertSame(14000.0, (float) $p->commission);
    }

    /* ── Rien ne part tant que tout n'est pas là ──────────────── */

    private function sejourTermine(Devis $devis): void
    {
        Reservation::whereKey($devis->fresh()->reservation_id)->update([
            'date_debut' => now()->subDays(5)->toDateString(),
            'date_fin'   => now()->subDay()->toDateString(),
        ]);
    }

    public function test_un_acompte_ne_rend_rien_exigible_mais_le_solde_oui(): void
    {
        $devis = $this->devis(200000);
        $this->encaisser($devis, 50000)->assertCreated();
        $this->sejourTermine($devis);

        $this->assertSame(0, Paiement::query()->exigible()->count());
        $this->assertSame(1, Paiement::query()->retenuFauteDeSolde()->count());
        $this->assertSame(1, Paiement::query()->soldeOuvert()->count());

        $this->encaisser($devis, 150000)->assertCreated();

        $this->assertSame(1, Paiement::query()->exigible()->count());
        $this->assertSame(0, Paiement::query()->retenuFauteDeSolde()->count());
        $this->assertSame(0, Paiement::query()->soldeOuvert()->count());
    }

    public function test_un_dossier_d_associes_ne_se_transmet_qu_une_fois_solde(): void
    {
        $annonce = $this->annonce();
        $annonce[0]->forceFill(['circuit' => 'associe', 'majoration' => 0.14])->save();
        $devis = $this->devis(114000, annonce: $annonce);

        $this->encaisser($devis, 14000)->assertCreated();
        $this->assertSame(0, Paiement::query()->aTransmettre()->count());

        $this->encaisser($devis, 100000)->assertCreated();
        $this->assertSame(1, Paiement::query()->aTransmettre()->count());
    }

    public function test_clore_arrete_le_dossier_a_ce_qui_a_ete_recu(): void
    {
        $devis = $this->devis(200000);
        $this->encaisser($devis, 80000)->assertCreated();
        $this->sejourTermine($devis);

        $this->actingAs($this->admin)->postJson("/api/admin/devis/{$devis->id}/clore-solde", ['motif' => 'Le client ne répond plus.'])
            ->assertOk()->assertJsonPath('solde', 0)->assertJsonPath('total', 80000);

        $p = Paiement::firstOrFail();
        $this->assertSame(0.0, (float) $p->solde);
        $this->assertSame((float) Commission::pour(80000)->commission, (float) $p->commission);
        $this->assertSame(1, Paiement::query()->exigible()->count());
        $this->assertTrue(JournalAdmin::where('action', 'devis.solde_clos')->exists());

        // Rien ne s'ajoute plus, et il n'y a plus rien à clore.
        $this->encaisser($devis, 1000)->assertStatus(409);
        $this->actingAs($this->admin)->postJson("/api/admin/devis/{$devis->id}/clore-solde", ['motif' => 'Le client ne répond plus.'])->assertStatus(409);
    }

    /* ── Les doublons ─────────────────────────────────────────── */

    public function test_une_meme_reference_ne_s_enregistre_pas_deux_fois(): void
    {
        $annonce = $this->annonce();
        $this->encaisser($this->devis(annonce: $annonce), 50000, ['reference' => 'WAVE-123'])->assertCreated();

        $autre = $this->devis(attributs: ['date_arrivee' => now()->addDays(30)->toDateString(), 'date_depart' => now()->addDays(31)->toDateString()], annonce: $annonce);
        $this->encaisser($autre, 50000, ['reference' => ' WAVE-123 '])->assertStatus(409)->assertJsonFragment(['message' => 'Cette référence est déjà enregistrée, sur le reçu '.Reglement::firstOrFail()->numero.'.']);

        // Le même numéro sur un autre moyen n'est pas la même transaction.
        $this->encaisser($autre, 50000, ['reference' => 'WAVE-123', 'moyen' => 'orange_money'])->assertCreated();
    }

    public function test_un_reglement_identique_demande_une_confirmation(): void
    {
        $devis = $this->devis();
        $this->encaisser($devis, 50000, ['moyen' => 'especes'])->assertCreated();

        $reponse = $this->encaisser($devis, 50000, ['moyen' => 'especes'])->assertStatus(409);
        $this->assertSame(Reglement::firstOrFail()->numero, $reponse->json('doublon'));

        $this->encaisser($devis, 50000, ['moyen' => 'especes', 'confirmer' => true])->assertCreated();
        $this->assertSame(2, Reglement::count());
    }

    public function test_on_n_enregistre_pas_une_somme_qui_n_est_pas_encore_recue(): void
    {
        $this->encaisser($this->devis(), 50000, ['recu_le' => now()->addDay()->toDateString()])
            ->assertStatus(422)->assertJsonValidationErrors('recu_le');
    }

    /* ── Se tromper, et le défaire ────────────────────────────── */

    public function test_annuler_le_dernier_reglement_rend_les_dates_et_garde_le_numero(): void
    {
        $devis = $this->devis();
        $this->encaisser($devis, 50000)->assertCreated();
        $reglement = Reglement::firstOrFail();
        $reservationId = $devis->fresh()->reservation_id;

        $this->actingAs($this->admin)->postJson("/api/admin/reglements/{$reglement->id}/annuler", ['motif' => 'Somme saisie sur le mauvais devis.'])
            ->assertOk()->assertJsonPath('statut', 'annule');

        $this->assertSame('annulee', Reservation::findOrFail($reservationId)->statut);
        $this->assertSame(0, Paiement::count());
        $devis->refresh();
        $this->assertNull($devis->reservation_id);
        $this->assertSame('emis', $devis->statut);

        // Le numéro est pris pour toujours, et le dossier peut repartir.
        $this->encaisser($devis, 50000)->assertCreated()->assertJsonPath('numero', 'RC-'.now()->year.'-0002');
        $this->assertSame('confirmee', $devis->fresh()->reservation->statut);
    }

    public function test_annuler_un_reglement_parmi_d_autres_recalcule_le_paiement(): void
    {
        $devis = $this->devis(200000);
        $this->encaisser($devis, 150000)->assertCreated();
        $this->encaisser($devis, 50000, ['moyen' => 'especes'])->assertCreated();
        $this->assertSame(0.0, (float) Paiement::firstOrFail()->solde);

        $erreur = Reglement::where('moyen', 'especes')->firstOrFail();
        $this->actingAs($this->admin)->postJson("/api/admin/reglements/{$erreur->id}/annuler", ['motif' => 'Cette somme n’est jamais arrivée.'])->assertOk();

        $p = Paiement::firstOrFail();
        $this->assertSame(150000.0, (float) $p->montant);
        $this->assertSame(50000.0, (float) $p->solde);
        $this->assertSame('confirmee', $devis->fresh()->reservation->statut);
    }

    public function test_on_n_annule_plus_une_fois_l_argent_reparti(): void
    {
        $devis = $this->devis(100000);
        $this->encaisser($devis, 100000)->assertCreated();
        $reglement = Reglement::firstOrFail();
        $p = Paiement::firstOrFail();
        $motif = ['motif' => 'Tentative après le versement.'];

        $reversement = new Reversement(['montant' => 88000, 'methode' => 'wave', 'statut' => 'manuel']);
        $reversement->forceFill(['user_id' => $devis->villa->user_id, 'beneficiaire_nom' => 'Propriétaire', 'createur_nom' => 'Équipe'])->save();
        $p->forceFill(['reversement_id' => $reversement->id])->save();
        $this->actingAs($this->admin)->postJson("/api/admin/reglements/{$reglement->id}/annuler", $motif)->assertStatus(409);

        $p->forceFill(['reversement_id' => null, 'transmis_le' => now()])->save();
        $this->actingAs($this->admin)->postJson("/api/admin/reglements/{$reglement->id}/annuler", $motif)->assertStatus(409);

        $p->forceFill(['transmis_le' => null])->save();
        $remboursement = new Remboursement(['paiement_id' => $p->id, 'reservation_id' => $p->reservation_id, 'impute_a' => 'plateforme', 'commission_rendue' => true, 'motif' => 'Essai de garde', 'createur_nom' => 'Test']);
        $remboursement->forceFill(['montant' => 1000, 'a_recuperer_proprietaire' => 0])->save();
        $this->actingAs($this->admin)->postJson("/api/admin/reglements/{$reglement->id}/annuler", $motif)->assertStatus(409);

        $this->assertSame('valide', $reglement->fresh()->statut);
    }

    /* ── Le client renonce ────────────────────────────────────── */

    public function test_le_client_qui_renonce_passe_par_les_remboursements_et_garde_les_dates_bloquees(): void
    {
        $devis = $this->devis(100000);
        $this->encaisser($devis, 100000)->assertCreated();
        $reservation = $devis->fresh()->reservation;

        $this->actingAs($this->admin)->postJson("/api/admin/devis/{$devis->id}/annulation", ['motif' => 'Le client annule son voyage.'])
            ->assertOk();

        $reservation->refresh();
        $this->assertNotNull($reservation->annulation_demandee_le);
        $this->assertSame('confirmee', $reservation->statut);

        $demandes = $this->actingAs($this->admin)->getJson('/api/admin/remboursements')->assertOk()->json('demandes');
        $this->assertSame('Awa Ndiaye', $demandes[0]['client']);
        $this->assertSame('+221761112233', $demandes[0]['contact']);
        $this->assertSame(100000.0, (float) $demandes[0]['montant']);
        $this->assertSame('Wave', $demandes[0]['paiement']['methode_nom']);

        // L'annulation attend : on n'encaisse pas par-dessus.
        $this->encaisser($devis, 1)->assertStatus(409);

        $this->actingAs($this->admin)->postJson("/api/admin/reservations/{$reservation->id}/remboursement", [
            'montant' => 100000, 'impute_a' => 'plateforme', 'motif' => 'Geste accepté, tout est rendu.',
        ])->assertSuccessful();

        $this->assertSame('annulee', $reservation->fresh()->statut);
        $this->assertSame(0, Paiement::query()->exigible()->count());
        $this->assertSame(0, Paiement::query()->soldeOuvert()->count());
        $this->encaisser($devis, 1)->assertStatus(409);
    }

    public function test_le_proprietaire_qui_annule_un_sejour_paye_envoie_l_argent_aux_remboursements(): void
    {
        $devis = $this->devis(100000);
        $this->encaisser($devis, 40000)->assertCreated();
        $reservation = $devis->fresh()->reservation;

        $this->actingAs($devis->villa->proprietaire)->patchJson("/api/reservations/{$reservation->id}/statut", ['statut' => 'annulee'])
            ->assertOk();

        $reservation->refresh();
        $this->assertSame('annulee', $reservation->statut);
        $this->assertNotNull($reservation->annulation_demandee_le);
        $this->assertTrue(Reservation::attendUneDecisionDeRemboursement()->whereKey($reservation->id)->exists());
    }

    /* ── Ce que voit le propriétaire ──────────────────────────── */

    public function test_le_proprietaire_lit_le_client_sans_compte_comme_les_autres(): void
    {
        $devis = $this->devis();
        $this->encaisser($devis, 50000)->assertCreated();

        $ligne = $this->actingAs($devis->villa->proprietaire)->getJson('/api/reservations')->assertOk()->json('0');

        $this->assertSame('Awa Ndiaye', $ligne['client']['name']);
        $this->assertSame('+221761112233', $ligne['client']['phone']);
        $this->assertNull($ligne['user_id']);
        $this->assertSame(150000.0, (float) $ligne['paiement']['solde']);
        $this->assertArrayNotHasKey('client_email', $ligne);
    }

    public function test_on_n_ecrit_pas_a_un_client_sans_compte(): void
    {
        $devis = $this->devis();
        $this->encaisser($devis, 50000)->assertCreated();
        $reservation = $devis->fresh()->reservation;

        $this->actingAs($devis->villa->proprietaire)->postJson("/api/reservations/{$reservation->id}/messages", ['corps' => 'Bonjour'])
            ->assertStatus(422);
    }

    /* ── Le devis une fois réglé ──────────────────────────────── */

    public function test_un_devis_regle_ne_se_supprime_pas_meme_si_le_reglement_est_annule(): void
    {
        $devis = $this->devis();
        $this->encaisser($devis, 50000)->assertCreated();
        $this->actingAs($this->admin)->deleteJson("/api/admin/devis/{$devis->id}")->assertStatus(422);

        $reglement = Reglement::firstOrFail();
        $this->actingAs($this->admin)->postJson("/api/admin/reglements/{$reglement->id}/annuler", ['motif' => 'Somme saisie par erreur.'])->assertOk();
        $this->actingAs($this->admin)->deleteJson("/api/admin/devis/{$devis->id}")->assertStatus(422);
        $this->assertNotNull(Devis::find($devis->id));
    }

    public function test_un_devis_regle_garde_son_sejour_et_son_montant_mais_se_corrige(): void
    {
        $devis = $this->devis(100000);
        $this->encaisser($devis, 50000)->assertCreated();
        $url = "/api/admin/devis/{$devis->id}";
        $this->actingAs($this->admin);

        $this->patchJson($url, ['date_arrivee' => now()->addDays(40)->toDateString(), 'date_depart' => now()->addDays(41)->toDateString()])->assertStatus(409);
        $this->patchJson($url, ['lignes' => [['designation' => 'Location', 'quantite' => 1, 'prix_unitaire' => 90000]]])->assertStatus(409);
        $this->patchJson($url, ['statut' => 'refuse'])->assertStatus(409);

        // Tel que l'écran l'envoie : tout le formulaire, sans rien changer au séjour.
        $this->patchJson($url, [
            'client_nom' => 'Awa Ndiaye Fall',
            'client_telephone' => '+221761112299',
            'date_arrivee' => $devis->date_arrivee->toDateString(),
            'date_depart' => $devis->date_depart->toDateString(),
            'villa_id' => $devis->villa_id,
            'logement_id' => $devis->logement_id,
            'tarif_id' => $devis->tarif_id,
            'personnes' => 2,
            'statut' => 'accepte',
            'lignes' => [['designation' => 'Location du logement', 'quantite' => 1, 'prix_unitaire' => 100000]],
        ])->assertOk();

        $reservation = $devis->fresh()->reservation;
        $this->assertSame('Awa Ndiaye Fall', $reservation->client->name);
        $this->assertSame('+221761112299', $reservation->client->phone);
        $this->assertSame('Awa Ndiaye', Reglement::firstOrFail()->client_nom);
    }

    /* ── Le reçu ──────────────────────────────────────────────── */

    public function test_le_recu_s_ouvre_par_sa_cle_et_seulement_par_elle(): void
    {
        $devis = $this->devis();
        $this->encaisser($devis, 50000, ['reference' => 'WAVE-9'])->assertCreated();
        $r = Reglement::firstOrFail();

        $this->get("/api/reglements/{$r->numero}/pdf")->assertNotFound();
        $this->get("/api/reglements/{$r->numero}/pdf?cle=mauvaise")->assertNotFound();
        $this->get("/api/reglements/RC-1900-0001/pdf?cle={$r->cle}")->assertNotFound();

        $reponse = $this->get("/api/reglements/{$r->numero}/pdf?cle={$r->cle}")->assertOk();
        $this->assertSame('application/pdf', $reponse->headers->get('Content-Type'));
        $this->assertStringStartsWith('%PDF', $reponse->getContent());
    }

    public function test_le_recu_dit_l_etat_du_dossier_a_ce_moment_la(): void
    {
        $devis = $this->devis(200000);
        $this->encaisser($devis, 50000, ['recu_le' => now()->subDays(2)->toDateString()])->assertCreated();
        $this->encaisser($devis, 150000)->assertCreated();

        [$premier, $second] = Reglement::orderBy('id')->get()->all();

        $avant = \App\Http\Controllers\Api\ReglementController::donnees($premier);
        $this->assertSame(0, $avant['avant']);
        $this->assertSame(150000, $avant['reste']);

        $apres = \App\Http\Controllers\Api\ReglementController::donnees($second);
        $this->assertSame(50000, $apres['avant']);
        $this->assertSame(0, $apres['reste']);
    }

    public function test_le_recu_ne_dit_rien_de_la_commission(): void
    {
        $devis = $this->devis();
        $this->encaisser($devis, 50000)->assertCreated();

        $html = view('pdf.recu', \App\Http\Controllers\Api\ReglementController::donnees(Reglement::firstOrFail()))->render();

        $this->assertStringContainsString('Awa Ndiaye', $html);
        $this->assertStringNotContainsString('ommission', $html);
        $this->assertStringNotContainsString('%', strip_tags(preg_replace('/<style.*?<\/style>/s', '', $html)));
    }

    public function test_un_recu_annule_le_dit(): void
    {
        $devis = $this->devis();
        $devis->update(['langue' => 'en']);
        $this->encaisser($devis, 50000)->assertCreated();
        $r = Reglement::firstOrFail();
        $this->assertSame('en', $r->langue);

        $this->actingAs($this->admin)->postJson("/api/admin/reglements/{$r->id}/annuler", ['motif' => 'Somme saisie par erreur.'])->assertOk();

        $html = view('pdf.recu', \App\Http\Controllers\Api\ReglementController::donnees($r->fresh()))->render();
        $this->assertStringContainsString('This receipt was cancelled', $html);
    }

    /* ── Les droits ───────────────────────────────────────────── */

    public function test_seule_l_equipe_enregistre_un_reglement(): void
    {
        $devis = $this->devis();

        $this->postJson("/api/admin/devis/{$devis->id}/reglements", ['montant' => 1, 'moyen' => 'wave', 'recu_le' => now()->toDateString()])->assertUnauthorized();
        $this->actingAs($devis->villa->proprietaire)->postJson("/api/admin/devis/{$devis->id}/reglements", ['montant' => 1, 'moyen' => 'wave', 'recu_le' => now()->toDateString()])->assertForbidden();
        $this->actingAs($devis->villa->proprietaire)->getJson('/api/admin/reglements')->assertForbidden();

        $this->assertSame(0, Reglement::count());
    }

    public function test_un_logement_ou_une_annonce_payes_ne_se_suppriment_pas(): void
    {
        $devis = $this->devis();
        $this->encaisser($devis, 50000)->assertCreated();
        $proprietaire = $devis->villa->proprietaire;

        $this->actingAs($proprietaire)->deleteJson("/api/villas/{$devis->villa_id}/logements/{$devis->logement_id}")->assertStatus(409);
        $this->actingAs($proprietaire)->deleteJson("/api/villas/{$devis->villa_id}")->assertStatus(409);

        $this->assertNotNull(Logement::find($devis->logement_id));
        $this->assertSame(1, Paiement::count());
    }

    /* ── Le registre et les écrans ────────────────────────────── */

    public function test_le_registre_donne_les_totaux_et_les_soldes_a_recevoir(): void
    {
        $annonce = $this->annonce();
        $devis = $this->devis(100000, annonce: $annonce);
        $this->encaisser($devis, 30000)->assertCreated();
        $this->encaisser($devis, 20000, ['moyen' => 'especes'])->assertCreated();
        $autre = $this->devis(50000, ['client_nom' => 'Moussa Ba', 'date_arrivee' => now()->addDays(30)->toDateString(), 'date_depart' => now()->addDays(31)->toDateString()], $annonce);
        $this->encaisser($autre, 50000)->assertCreated();

        $page = $this->actingAs($this->admin)->getJson('/api/admin/reglements')->assertOk()->json();
        $this->assertSame(3, $page['total']);
        $this->assertSame(80000, collect($page['totaux'])->firstWhere('moyen', 'wave')['total']);
        $this->assertCount(1, $page['soldes']);
        $this->assertSame(50000, $page['soldes'][0]['solde']);
        $this->assertSame('Awa Ndiaye', $page['soldes'][0]['client']);
        $this->assertArrayNotHasKey('cle', $page['data'][0]);

        $this->assertCount(1, $this->getJson('/api/admin/reglements?recherche=Moussa')->json('data'));
        $this->assertCount(1, $this->getJson('/api/admin/reglements?moyen=especes')->json('data'));

        $csv = $this->get('/api/admin/reglements/export')->assertOk()->getContent();
        $this->assertStringContainsString('Moussa Ba', $csv);
        $this->assertTrue(JournalAdmin::where('action', 'reglements.exporte')->exists());
    }

    public function test_ce_qui_attend_rappelle_le_solde_qui_n_arrive_pas(): void
    {
        $devis = $this->devis(100000);
        $this->encaisser($devis, 40000)->assertCreated();

        // Arrivée lointaine : rien à rappeler encore.
        $cles = fn () => collect($this->actingAs($this->admin)->getJson('/api/admin/attentes')->assertOk()->json('lignes'))->pluck('cle');
        $this->assertFalse($cles()->contains('soldes'));

        $this->sejourTermine($devis);
        $ligne = collect($this->actingAs($this->admin)->getJson('/api/admin/attentes')->json('lignes'))->firstWhere('cle', 'soldes');
        $this->assertSame('urgent', $ligne['gravite']);

        $fonds = $this->actingAs($this->admin)->getJson('/api/admin/attentes')->json('fonds');
        $this->assertSame((float) Paiement::firstOrFail()->montant_proprietaire, (float) $fonds['retenu']);
        $this->assertSame((float) $fonds['retenu'], (float) $fonds['detenus']);
        $this->assertSame(0.0, (float) $fonds['exigible']);
    }

    public function test_le_pilotage_ne_compte_rien_deux_fois(): void
    {
        $devis = $this->devis(200000, ['origine' => 'site']);
        Devis::whereKey($devis->id)->update(['origine' => 'site']);
        $devis->refresh();

        $this->encaisser($devis, 50000, ['recu_le' => now()->subDays(40)->toDateString()])->assertCreated();
        $this->encaisser($devis, 150000, ['moyen' => 'especes'])->assertCreated();

        $sur = fn ($a, $b) => Pilotage::pour($a, $b);
        $mesure = fn (array $p, string $cle) => collect($p['indicateurs'])->firstWhere('cle', $cle)['valeur'];

        // Le mois en cours : le devis et sa réservation, c'est une seule demande.
        $p = $sur(now()->subDays(10), now());
        $this->assertSame(1, $mesure($p, 'demandes'));
        $this->assertSame(1, $mesure($p, 'accords'));
        $this->assertSame(150000, $mesure($p, 'encaisse'));
        $this->assertSame(200000, $mesure($p, 'volume_confirme'));

        $commission = Commission::pour(200000)->commission;
        $this->assertLessThanOrEqual($commission, $mesure($p, 'commission'));
        $this->assertGreaterThan(0, $mesure($p, 'commission'));

        // L'acompte compte à la date où il est entré, pas au dernier paiement.
        $large = $sur(now()->subDays(60), now());
        $this->assertSame(200000, $mesure($large, 'encaisse'));
        $this->assertEqualsWithDelta($commission, $mesure($large, 'commission'), 1);
        $moyens = collect($large['repartitions']['moyens'])->pluck('valeur', 'nom');
        $this->assertSame(50000, $moyens['Wave']);
        $this->assertSame(150000, $moyens['Espèces']);

        // Aucun essai de paiement en ligne n'a eu lieu.
        $this->assertEmpty(collect($large['manquements'])->filter(fn ($m) => str_contains($m['titre'], 'paiements échouent')));
    }

    public function test_les_essais_marques_ne_faussent_pas_les_chiffres(): void
    {
        $devis = $this->devis(100000, ['client_nom' => Pilotage::MARQUE_TEST.' — à ignorer']);
        $this->encaisser($devis, 100000)->assertCreated();

        $p = Pilotage::pour(now()->subDays(5), now());
        $this->assertSame(0, collect($p['indicateurs'])->firstWhere('cle', 'encaisse')['valeur']);
        $this->assertSame(0, collect($p['indicateurs'])->firstWhere('cle', 'volume_confirme')['valeur']);
        $this->assertEmpty(array_filter(FichierClients::construire(), fn ($c) => str_contains($c['nom'], Pilotage::MARQUE_TEST)));
    }

    public function test_le_pilotage_signale_l_argent_qui_manque(): void
    {
        $devis = $this->devis(100000);
        $this->encaisser($devis, 40000)->assertCreated();
        $this->sejourTermine($devis);

        $proche = $this->devis(50000, ['client_nom' => 'Moussa Ba', 'date_arrivee' => now()->addDays(4)->toDateString(), 'date_depart' => now()->addDays(5)->toDateString()]);
        $proche->forceFill(['statut' => 'accepte'])->save();

        $titres = collect(Pilotage::pour(now()->subDays(5), now())['manquements'])->pluck('titre')->implode(' | ');
        $this->assertStringContainsString('1 séjour terminé avec un solde impayé', $titres);
        $this->assertStringContainsString('1 devis accepté sans règlement', $titres);
    }

    public function test_le_fichier_clients_range_le_reglement_avec_son_client(): void
    {
        $devis = $this->devis(100000);
        $this->encaisser($devis, 40000, ['payeur_telephone' => '77 000 00 01'])->assertCreated();

        $clients = FichierClients::construire();
        $this->assertCount(1, $clients);
        $this->assertSame(1, $clients[0]['nombres']['devis']);
        $this->assertSame(1, $clients[0]['nombres']['reglements']);
        $this->assertSame(40000, $clients[0]['montant_regle']);
        // Le numéro du payeur ne devient pas celui du client.
        $this->assertSame(['+221761112233'], $clients[0]['telephones']);
    }

    public function test_la_conservation_retire_les_recus_et_les_coordonnees_apres_dix_ans(): void
    {
        $devis = $this->devis();
        $this->encaisser($devis, 50000)->assertCreated();
        $reservation = $devis->fresh()->reservation;

        $this->artisan('passetemps:effacer-devis-et-demandes')->assertSuccessful();
        $this->assertSame(1, Reglement::count());

        Reglement::query()->update(['recu_le' => now()->subYears(11)->toDateString()]);
        Reservation::whereKey($reservation->id)->update(['date_debut' => now()->subYears(11)->toDateString(), 'date_fin' => now()->subYears(11)->toDateString()]);

        $this->artisan('passetemps:effacer-devis-et-demandes')->assertSuccessful();

        $this->assertSame(0, Reglement::count());
        $this->assertSame('Client sans compte', $reservation->fresh()->client->name);
        $this->assertNull($reservation->fresh()->client->phone);
    }
}
