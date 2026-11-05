<?php

namespace Tests\Feature;

use App\Models\DemandeParticuliere;
use App\Models\Devis;
use App\Models\DevisRefuse;
use App\Models\JournalAdmin;
use App\Services\FichierClients;
use App\Services\Pilotage;
use App\Models\Logement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use App\Http\Controllers\Api\DevisController;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Les devis. Ce qu'un client télécharge en ligne engage PasseTemps comme une
 * réservation : prix lu sur le tarif, mêmes refus, numéros sans trou ni double.
 */
class DevisTest extends TestCase
{
    use RefreshDatabase;

    private function annonce(array $logement = [], array $tarif = []): array
    {
        $villa = Villa::factory()->validee()->create(['nom' => 'Résidence Kabrousse', 'ville' => 'Saly']);
        $l = Logement::create($logement + [
            'villa_id'   => $villa->id,
            'nom'        => 'Chambre climatisée',
            'type'       => 'chambre',
            'capacite'   => 2,
            'disponible' => true,
        ]);
        $t = Tarif::create($tarif + [
            'logement_id' => $l->id,
            'type_tarif'  => 'nuitee',
            'prix'        => 25000,
            'avec_clim'   => true,
            'avec_buffet' => false,
        ]);

        return [$villa, $l, $t];
    }

    private function demande(Logement $l, Tarif $t, array $en_plus = []): array
    {
        return $en_plus + [
            'logement_id'  => $l->id,
            'tarif_id'     => $t->id,
            'date_debut'   => now()->addDays(10)->toDateString(),
            'date_fin'     => now()->addDays(12)->toDateString(),
            'nb_personnes' => 1,
            'client_nom'   => 'FAN MILK S/C LDB',
            'occupant_nom' => 'Mansour Sow',
            'telephone'    => '77 123 45 67',
        ];
    }

    /* ── En ligne ─────────────────────────────────────────────── */

    public function test_un_devis_en_ligne_se_calcule_sur_le_tarif_et_jamais_sur_la_requete(): void
    {
        [, $l, $t] = $this->annonce();

        $reponse = $this->postJson('/api/devis', $this->demande($l, $t, [
            'total'  => 1,
            'lignes' => [['designation' => 'Cadeau', 'quantite' => 1, 'prix_unitaire' => 1]],
        ]))->assertCreated();

        $devis = Devis::firstOrFail();
        $this->assertSame(50000, $devis->total);
        $this->assertCount(1, $devis->lignes);
        $this->assertSame(2, $devis->lignes[0]['quantite']);
        $this->assertSame(25000, $devis->lignes[0]['prix_unitaire']);
        $this->assertSame('site', $devis->origine);
        $this->assertFalse($devis->cachet);
        $this->assertSame($devis->numero, $reponse->json('numero'));
        $this->assertStringContainsString('/api/devis/'.$devis->numero.'/pdf?cle=', $reponse->json('pdf'));
    }

    public function test_les_devis_en_ligne_ont_leur_propre_serie(): void
    {
        [, $l, $t] = $this->annonce();
        $annee = now()->year;

        $this->postJson('/api/devis', $this->demande($l, $t))->assertCreated()->assertJsonPath('numero', "PT-{$annee}-L0001");
        $this->postJson('/api/devis', $this->demande($l, $t))->assertCreated()->assertJsonPath('numero', "PT-{$annee}-L0002");
    }

    public function test_un_devis_en_ligne_refuse_ce_qu_une_reservation_refuserait(): void
    {
        [$villa, $l, $t] = $this->annonce(['nuits_minimum' => 3]);
        [, $autre, $tarifAutre] = $this->annonce();

        // Séjour trop court.
        $this->postJson('/api/devis', $this->demande($l, $t))->assertStatus(422)->assertJsonValidationErrors('date_fin');
        // Formule d'un autre logement.
        $this->postJson('/api/devis', $this->demande($l, $tarifAutre))->assertStatus(422)->assertJsonValidationErrors('tarif_id');
        // Trop de monde.
        $this->postJson('/api/devis', $this->demande($autre, $tarifAutre, ['nb_personnes' => 9]))->assertStatus(422);
        // Dates déjà prises.
        Reservation::create([
            'user_id'       => User::factory()->create()->id,
            'logement_id'   => $autre->id,
            'tarif_id'      => $tarifAutre->id,
            'date_debut'    => now()->addDays(11)->toDateString(),
            'date_fin'      => now()->addDays(13)->toDateString(),
            'nb_personnes'  => 1,
            'montant_total' => 50000,
            'statut'        => 'confirmee',
        ]);
        $this->postJson('/api/devis', $this->demande($autre, $tarifAutre))->assertStatus(409);
        // Annonce retirée.
        $villa->update(['statut' => 'rejetee']);
        $this->postJson('/api/devis', $this->demande($l, $t, [
            'date_fin' => now()->addDays(14)->toDateString(),
        ]))->assertStatus(409);

        $this->assertSame(0, Devis::count());
    }

    public function test_le_pdf_ne_s_ouvre_qu_avec_sa_cle(): void
    {
        [, $l, $t] = $this->annonce();
        $lien = $this->postJson('/api/devis', $this->demande($l, $t))->json('pdf');
        $devis = Devis::firstOrFail();

        $this->get("/api/devis/{$devis->numero}/pdf?cle=mauvaise")->assertNotFound();
        $this->get("/api/devis/{$devis->numero}/pdf")->assertNotFound();

        $reponse = $this->get(parse_url($lien, PHP_URL_PATH).'?'.parse_url($lien, PHP_URL_QUERY))->assertOk();
        $this->assertSame('application/pdf', $reponse->headers->get('Content-Type'));
        $this->assertStringStartsWith('%PDF', $reponse->getContent());
        $this->assertStringContainsString('attachment', $reponse->headers->get('Content-Disposition'));
    }

    public function test_le_document_dit_le_montant_en_lettres_et_le_client(): void
    {
        [, $l, $t] = $this->annonce();
        $this->postJson('/api/devis', $this->demande($l, $t))->assertCreated();
        $devis = Devis::firstOrFail();

        $html = view('pdf.devis', [
            'devis'       => $devis,
            'emetteur'    => config('devis.emetteur') + ['telephone' => '+221 75 446 90 41', 'email' => 'contactptemps@gmail.com'],
            'logo'        => null,
            'cachetImage' => null,
            'enLettres'   => 'cinquante mille francs CFA',
            'sousTitre'   => 'Saly',
            'duree'       => '2 nuitées',
        ])->render();

        $this->assertStringContainsString('cinquante mille francs CFA', $html);
        $this->assertStringContainsString('FAN MILK S/C LDB', $html);
        $this->assertStringContainsString('Mansour Sow', $html);
        $this->assertStringContainsString('Établi en ligne', $html);
        $this->assertStringNotContainsString('PASSETEMPS</div>', $html, 'Pas de cachet sur un devis établi en ligne.');
        $this->assertNotEmpty(DevisController::rendre($devis));
    }

    public function test_un_client_venu_de_la_version_anglaise_recoit_son_devis_en_anglais(): void
    {
        [, $l, $t] = $this->annonce();
        $lien = $this->postJson('/api/devis', $this->demande($l, $t, ['langue' => 'en']))->assertCreated()->json('pdf');
        $devis = Devis::firstOrFail();

        $this->assertSame('en', $devis->langue);
        $this->assertSame('Rental · Chambre climatisée', $devis->lignes[0]['designation']);
        $this->assertSame('Night, with air conditioning', $devis->lignes[0]['detail']);
        $this->assertSame('night', $devis->lignes[0]['unite']);

        $html = view('pdf.devis', DevisController::donnees($devis))->render();
        foreach (['Rental quote', 'Prepared online', 'Total due', 'fifty thousand CFA francs', '2 nights',
            'To be confirmed by the PasseTemps team', 'Quote prepared online at the customer'] as $attendu) {
            $this->assertStringContainsString($attendu, $html);
        }
        foreach (['Devis de location', 'Total à payer', 'Arrêté le présent', 'nuitée', 'francs CFA'] as $absent) {
            $this->assertStringNotContainsString($absent, $html);
        }
        $this->assertMatchesRegularExpression('/[A-Z][a-z]+day, \d{1,2} [A-Z][a-z]+ \d{4}/', $html, 'Les dates aussi, en anglais.');

        $reponse = $this->get(parse_url($lien, PHP_URL_PATH).'?'.parse_url($lien, PHP_URL_QUERY))->assertOk();
        $this->assertStringContainsString("Quote-{$devis->numero}.pdf", $reponse->headers->get('Content-Disposition'));
    }

    public function test_sans_langue_le_devis_reste_en_francais(): void
    {
        [, $l, $t] = $this->annonce();
        $this->postJson('/api/devis', $this->demande($l, $t))->assertCreated();
        $html = view('pdf.devis', DevisController::donnees(Devis::firstOrFail()))->render();

        $this->assertStringContainsString('Devis de location', $html);
        $this->assertStringContainsString('cinquante mille francs CFA', $html);
        $this->assertStringContainsString('2 nuitées', $html);
        $this->assertStringNotContainsString('Rental', $html);
    }

    public function test_un_devis_en_ligne_garde_un_numero_pour_repondre(): void
    {
        [, $l, $t] = $this->annonce();

        $sans = $this->demande($l, $t);
        unset($sans['telephone']);
        $this->postJson('/api/devis', $sans)->assertStatus(422)->assertJsonValidationErrors('telephone');
        $this->postJson('/api/devis', $this->demande($l, $t, ['telephone' => '77 12']))
            ->assertStatus(422)->assertJsonValidationErrors('telephone');
        $this->assertSame(0, Devis::count());

        // Un numéro étranger, collé depuis WhatsApp avec ses marques invisibles.
        $this->postJson('/api/devis', $this->demande($l, $t, ['telephone' => "\u{202A}+44 7700 900123\u{202C}"]))->assertCreated();
        $this->assertSame('+44 7700 900123', Devis::firstOrFail()->client_telephone);
    }

    public function test_les_durees_de_la_politique_de_confidentialite_sont_tenues(): void
    {
        $vieux = function (string $statut, int $ans) {
            $d = Devis::etablir('console', ['titre' => 'Séjour', 'client_nom' => 'Awa'], [
                ['designation' => 'Location', 'quantite' => 1, 'prix_unitaire' => 1000],
            ]);
            $d->statut = $statut;
            $d->created_at = now()->subYears($ans)->subDay();
            $d->save();

            return $d;
        };
        $demande = function (int $ans) {
            $d = DemandeParticuliere::create(['type' => 'groupe', 'message' => 'Dix personnes', 'nom' => 'Awa', 'langue' => 'fr']);
            $d->created_at = now()->subYears($ans)->subDay();
            $d->save();

            return $d;
        };

        $garde = [$vieux('accepte', 9), $vieux('emis', 2), $vieux('refuse', 2)];
        $efface = [$vieux('accepte', 10), $vieux('emis', 3), $vieux('refuse', 3)];
        $demandeRecente = $demande(2);
        $demandeAncienne = $demande(3);

        $this->artisan('passetemps:effacer-devis-et-demandes')->assertSuccessful();

        foreach ($garde as $d) {
            $this->assertNotNull(Devis::find($d->id), "Le devis {$d->statut} doit rester.");
        }
        foreach ($efface as $d) {
            $this->assertNull(Devis::find($d->id), "Le devis {$d->statut} doit partir.");
        }
        $this->assertNotNull(DemandeParticuliere::find($demandeRecente->id));
        $this->assertNull(DemandeParticuliere::find($demandeAncienne->id));
    }

    /* ── Supprimer ────────────────────────────────────────────── */

    private function devisEnLigne(?Logement $l = null, ?Tarif $t = null): Devis
    {
        if (! $l) {
            [, $l, $t] = $this->annonce();
        }
        $this->postJson('/api/devis', $this->demande($l, $t, ['client_nom' => 'Awa Ndiaye', 'email' => 'awa@exemple.sn']))->assertCreated();

        return Devis::latest('id')->firstOrFail();
    }

    public function test_supprimer_un_devis_efface_le_client_et_ferme_le_pdf(): void
    {
        $devis = $this->devisEnLigne();
        $lien = $devis->urlPdf();
        $chemin = parse_url($lien, PHP_URL_PATH).'?'.parse_url($lien, PHP_URL_QUERY);
        $this->get($chemin)->assertOk();

        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $this->deleteJson("/api/admin/devis/{$devis->id}")->assertOk();

        $this->get($chemin)->assertNotFound();
        $this->getJson('/api/admin/devis')->assertJsonPath('total', 0);
        $this->getJson("/api/admin/devis/{$devis->id}")->assertNotFound();

        $reste = Devis::withTrashed()->findOrFail($devis->id);
        $this->assertNotNull($reste->deleted_at);
        foreach (['Awa Ndiaye', 'awa@exemple.sn', '77 123 45 67', 'Mansour Sow', 'Kabrousse', 'Chambre'] as $trace) {
            $this->assertStringNotContainsString($trace, json_encode($reste->getAttributes(), JSON_UNESCAPED_UNICODE), "« {$trace} » ne doit pas survivre.");
        }
    }

    public function test_le_numero_d_un_devis_supprime_n_est_jamais_redonne(): void
    {
        [, $l, $t] = $this->annonce();
        $devis = $this->devisEnLigne($l, $t);
        $numero = $devis->numero;

        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $this->deleteJson("/api/admin/devis/{$devis->id}")->assertOk();

        $suivant = $this->devisEnLigne($l, $t);

        $this->assertNotSame($numero, $suivant->numero);
        $this->assertSame($devis->rang + 1, $suivant->rang);
    }

    public function test_un_devis_accepte_ne_se_supprime_pas_tant_qu_il_l_est(): void
    {
        $devis = $this->devisEnLigne();
        $devis->statut = 'accepte';
        $devis->save();

        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $this->deleteJson("/api/admin/devis/{$devis->id}")->assertStatus(422);
        $this->assertSame('Awa Ndiaye', $devis->fresh()->client_nom);

        $this->patchJson("/api/admin/devis/{$devis->id}", ['statut' => 'refuse'])->assertOk();
        $this->deleteJson("/api/admin/devis/{$devis->id}")->assertOk();
        $this->assertNull(Devis::find($devis->id));
    }

    public function test_le_journal_garde_le_numero_et_oublie_le_client(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $id = $this->postJson('/api/admin/devis', [
            'titre' => 'Séjour', 'client_nom' => 'Awa Ndiaye',
            'lignes' => [['designation' => 'Location', 'quantite' => 1, 'prix_unitaire' => 1000]],
        ])->assertCreated()->json('id');
        $this->assertSame('Awa Ndiaye', JournalAdmin::where('action', 'devis.etabli')->firstOrFail()->details['client']);

        $this->deleteJson("/api/admin/devis/{$id}")->assertOk();

        $this->assertArrayNotHasKey('client', JournalAdmin::where('action', 'devis.etabli')->firstOrFail()->details ?? []);
        $trace = JournalAdmin::where('action', 'devis.supprime')->firstOrFail();
        $this->assertStringStartsWith('PT-', $trace->cible_libelle);
        $this->assertSame(1000, $trace->details['total']);
    }

    public function test_seul_l_admin_supprime_un_devis(): void
    {
        $devis = $this->devisEnLigne();

        $this->deleteJson("/api/admin/devis/{$devis->id}")->assertUnauthorized();
        $this->actingAs(User::factory()->create(['role' => 'client']));
        $this->deleteJson("/api/admin/devis/{$devis->id}")->assertForbidden();
        $this->assertNotNull(Devis::find($devis->id));
    }

    public function test_un_devis_supprime_disparait_du_fichier_et_du_pilotage(): void
    {
        $devis = $this->devisEnLigne();
        $this->assertCount(1, FichierClients::construire());

        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $this->deleteJson("/api/admin/devis/{$devis->id}")->assertOk();

        $this->assertSame([], FichierClients::construire());
        $chiffres = collect(Pilotage::pour(now()->subDay(), now())['indicateurs'])->keyBy('cle');
        $this->assertSame(0, $chiffres['devis']['valeur']);
        $this->assertSame(0, $chiffres['demandes']['valeur']);
    }

    public function test_l_effacement_programme_retire_aussi_les_devis_supprimes_pour_de_bon(): void
    {
        $devis = $this->devisEnLigne();
        $devis->effacer();
        Devis::withTrashed()->whereKey($devis->id)->update(['created_at' => now()->subYears(3)->subDay()]);

        $garde = $this->devisEnLigne();
        Devis::whereKey($garde->id)->update(['created_at' => now()->subYears(3)->subDay()]);

        $this->artisan('passetemps:effacer-devis-et-demandes')->assertSuccessful();

        $this->assertNull(Devis::withTrashed()->find($devis->id));
        $this->assertNull(Devis::withTrashed()->find($garde->id), 'Un simple delete() ne ferait que le marquer, coordonnées comprises.');
    }

    /* ── Compter ce que le site refuse ───────────────────────── */

    public function test_chaque_refus_est_compte_avec_son_motif_sans_donnee_personnelle(): void
    {
        [$villa, $l, $t] = $this->annonce(['nuits_minimum' => 3]);

        $this->postJson('/api/devis', $this->demande($l, $t))->assertStatus(422);
        $this->assertSame('trop_court', DevisRefuse::latest('id')->firstOrFail()->motif);

        $this->postJson('/api/devis', $this->demande($l, $t, ['date_fin' => now()->addDays(14)->toDateString(), 'nb_personnes' => 9]))->assertStatus(422);
        $this->assertSame('trop_de_monde', DevisRefuse::latest('id')->firstOrFail()->motif);

        Reservation::create([
            'user_id' => User::factory()->create()->id, 'logement_id' => $l->id, 'tarif_id' => $t->id,
            'date_debut' => now()->addDays(11)->toDateString(), 'date_fin' => now()->addDays(13)->toDateString(),
            'nb_personnes' => 1, 'montant_total' => 50000, 'statut' => 'confirmee',
        ]);
        $this->postJson('/api/devis', $this->demande($l, $t, ['date_fin' => now()->addDays(15)->toDateString()]))->assertStatus(409);
        $refus = DevisRefuse::latest('id')->firstOrFail();
        $this->assertSame('dates_prises', $refus->motif);
        $this->assertSame($villa->id, $refus->villa_id);

        $villa->update(['statut' => 'rejetee']);
        $this->postJson('/api/devis', $this->demande($l, $t, ['date_fin' => now()->addDays(16)->toDateString()]))->assertStatus(409);
        $this->assertSame('retire', DevisRefuse::latest('id')->firstOrFail()->motif);

        $this->assertSame(4, DevisRefuse::count());
        $this->assertSame(0, Devis::count());
        $brut = json_encode(DevisRefuse::get()->map->getAttributes(), JSON_UNESCAPED_UNICODE);
        foreach (['FAN MILK', 'Mansour', '77 123'] as $trace) {
            $this->assertStringNotContainsString($trace, $brut);
        }
    }

    public function test_celui_qui_reessaie_les_memes_dates_ne_compte_qu_une_fois(): void
    {
        [, $l, $t] = $this->annonce(['nuits_minimum' => 3]);

        $this->postJson('/api/devis', $this->demande($l, $t))->assertStatus(422);
        $this->postJson('/api/devis', $this->demande($l, $t))->assertStatus(422);
        $this->assertSame(1, DevisRefuse::count());

        // D'autres dates, c'est une autre demande.
        $this->postJson('/api/devis', $this->demande($l, $t, ['date_debut' => now()->addDays(20)->toDateString(), 'date_fin' => now()->addDays(21)->toDateString()]))->assertStatus(422);
        $this->assertSame(2, DevisRefuse::count());
    }

    public function test_un_formulaire_incomplet_ou_un_robot_ne_compte_pas(): void
    {
        [, $l, $t] = $this->annonce(['nuits_minimum' => 3]);

        $sansNom = $this->demande($l, $t);
        unset($sansNom['client_nom']);
        $this->postJson('/api/devis', $sansNom)->assertStatus(422);
        $this->postJson('/api/devis', $this->demande($l, $t, ['site_web' => 'http://spam']))->assertCreated();

        $this->assertSame(0, DevisRefuse::count());
    }

    public function test_le_pilotage_montre_les_devis_refuses(): void
    {
        config(['reservations.ouvertes' => true]);
        [, $l, $t] = $this->annonce(['nuits_minimum' => 5]);
        foreach ([20, 30, 40] as $jour) {
            $this->postJson('/api/devis', $this->demande($l, $t, [
                'date_debut' => now()->addDays($jour)->toDateString(),
                'date_fin'   => now()->addDays($jour + 1)->toDateString(),
            ]))->assertStatus(422);
        }

        $p = Pilotage::pour(now()->subDay(), now());

        $this->assertSame(3, collect($p['indicateurs'])->firstWhere('cle', 'devis_refuses')['valeur']);
        $this->assertSame([['nom' => 'Séjour trop court', 'valeur' => 3]], $p['repartitions']['refus']);
        $this->assertSame(3, $p['hebergements'][0]['refus']);
        $this->assertSame(3, $p['villes'][0]['refus']);
        $this->assertSame(3, array_sum(array_column($p['series']['lignes'], 'refus')));
        $this->assertContains('3 devis refusés par le site sur la période', array_column($p['manquements'], 'titre'));
    }

    public function test_le_champ_piege_ne_cree_rien(): void
    {
        [, $l, $t] = $this->annonce();
        $this->postJson('/api/devis', $this->demande($l, $t, ['site_web' => 'http://spam']))->assertCreated();
        $this->assertSame(0, Devis::count());
    }

    /* ── La console ───────────────────────────────────────────── */

    public function test_l_equipe_etablit_un_devis_numerote_apres_celui_fait_a_la_main(): void
    {
        $admin = User::factory()->admin()->create();
        $annee = now()->year;

        $reponse = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/devis', [
            'titre'        => 'Résidence Kabrousse',
            'client_nom'   => 'FAN MILK S/C LDB',
            'occupant_nom' => 'Mansour Sow',
            'cachet'       => true,
            'lignes'       => [
                ['designation' => 'Location d’une chambre climatisée', 'quantite' => 2, 'unite' => 'nuitée', 'prix_unitaire' => 25000, 'montant' => 1],
                ['designation' => 'Petit-déjeuner', 'quantite' => 2, 'prix_unitaire' => 3000],
            ],
        ])->assertCreated();

        $this->assertSame("PT-{$annee}-002", $reponse->json('numero'));
        $this->assertSame(56000, $reponse->json('total'));
        $this->assertSame(50000, $reponse->json('lignes.0.montant'));
        $this->assertNotNull($reponse->json('pdf'));
        $this->assertTrue(Devis::firstOrFail()->cachet);
        $this->assertDatabaseHas('journal_admin', ['action' => 'devis.etabli']);
    }

    public function test_modifier_un_devis_garde_son_numero_et_recalcule(): void
    {
        $admin = User::factory()->admin()->create();
        $id = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/devis', [
            'titre' => 'Villa', 'client_nom' => 'Awa',
            'lignes' => [['designation' => 'Nuitée', 'quantite' => 1, 'prix_unitaire' => 10000]],
        ])->json('id');
        $numero = Devis::findOrFail($id)->numero;

        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/devis/{$id}", [
            'lignes' => [['designation' => 'Nuitée', 'quantite' => 3, 'prix_unitaire' => 10000]],
            'statut' => 'accepte',
        ])->assertOk()->assertJsonPath('total', 30000)->assertJsonPath('numero', $numero)->assertJsonPath('statut', 'accepte');
    }

    public function test_seul_l_admin_voit_et_etablit_les_devis(): void
    {
        $client = User::factory()->create();

        $this->actingAs($client, 'sanctum')->getJson('/api/admin/devis')->assertForbidden();
        $this->actingAs($client, 'sanctum')->postJson('/api/admin/devis', [
            'titre' => 'X', 'client_nom' => 'Y', 'lignes' => [['designation' => 'Z', 'quantite' => 1, 'prix_unitaire' => 1]],
        ])->assertForbidden();
    }

    public function test_un_devis_en_ligne_apparait_dans_ce_qui_attend_jusqu_a_ce_qu_on_le_suive(): void
    {
        $admin = User::factory()->admin()->create();
        [, $l, $t] = $this->annonce();
        $this->postJson('/api/devis', $this->demande($l, $t))->assertCreated();

        $cles = fn () => collect($this->actingAs($admin, 'sanctum')->getJson('/api/admin/attentes')->json('lignes'))->pluck('cle');
        $this->assertContains('devis_en_ligne', $cles());

        $this->actingAs($admin, 'sanctum')->patchJson('/api/admin/devis/'.Devis::firstOrFail()->id, ['suivi' => true])->assertOk();
        $this->assertNotContains('devis_en_ligne', $cles());
    }
}
