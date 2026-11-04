<?php

namespace Tests\Feature;

use App\Models\DemandeParticuliere;
use App\Models\Devis;
use App\Models\Logement;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use App\Services\FichierClients;
use App\Services\Pilotage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Un chiffre faux dans un tableau de pilotage fait prendre de mauvaises décisions.
 * On vérifie ici ce qui est compté, sur quelle période, et ce qui ne l'est pas.
 */
class PilotageTest extends TestCase
{
    use RefreshDatabase;

    private function annonce(string $nom = 'Résidence Kabrousse', string $ville = 'Saly', bool $prix = true): Villa
    {
        $villa = Villa::factory()->validee()->create(['nom' => $nom, 'ville' => $ville]);
        $logement = Logement::create(['villa_id' => $villa->id, 'nom' => 'Chambre', 'type' => 'chambre', 'capacite' => 2, 'disponible' => true]);
        if ($prix) {
            Tarif::create(['logement_id' => $logement->id, 'type_tarif' => 'nuitee', 'prix' => 25000, 'avec_clim' => false, 'avec_buffet' => false]);
        }

        return $villa;
    }

    private function devis(array $attributs = [], ?Carbon $le = null): Devis
    {
        $d = Devis::etablir($attributs['origine'] ?? 'site', $attributs + [
            'titre' => 'Séjour', 'client_nom' => 'Awa Ndiaye', 'client_telephone' => '77 123 45 67',
        ], [['designation' => 'Location', 'quantite' => 2, 'prix_unitaire' => 25000]]);

        if ($le) {
            $d->created_at = $le;
            $d->save();
        }

        return $d;
    }

    private function indicateur(array $p, string $cle): array
    {
        return collect($p['indicateurs'])->firstWhere('cle', $cle);
    }

    public function test_la_periode_se_compare_a_celle_d_egale_duree_qui_la_precede(): void
    {
        Carbon::setTestNow('2026-11-30 12:00:00');
        $this->devis([], Carbon::parse('2026-11-20 10:00'));
        $this->devis([], Carbon::parse('2026-11-25 10:00'));
        $this->devis([], Carbon::parse('2026-10-15 10:00'));
        $this->devis([], Carbon::parse('2026-09-01 10:00'));

        $p = Pilotage::pour(Carbon::parse('2026-11-01'), Carbon::parse('2026-11-30'));

        $this->assertSame(30, $p['periode']['jours']);
        $this->assertSame('2026-10-02', $p['periode']['avant_du']);
        $this->assertSame('2026-10-31', $p['periode']['avant_au']);
        $this->assertSame(2, $this->indicateur($p, 'devis')['valeur']);
        $this->assertSame(1, $this->indicateur($p, 'devis')['precedent']);
        $this->assertSame(100000, $this->indicateur($p, 'devis_montant')['valeur']);
    }

    public function test_les_essais_en_production_ne_faussent_aucun_chiffre(): void
    {
        $this->devis(['client_nom' => 'TEST PasseTemps — à ignorer', 'client_telephone' => '77 000 00 00']);
        DemandeParticuliere::create(['type' => 'groupe', 'message' => 'Essai', 'nom' => 'TEST PasseTemps — à ignorer', 'langue' => 'fr']);
        $this->devis(['client_nom' => 'Vrai client']);

        $p = Pilotage::pour(now()->subDay(), now());

        $this->assertSame(1, $this->indicateur($p, 'devis')['valeur']);
        $this->assertSame(1, $this->indicateur($p, 'demandes')['valeur']);
        $this->assertCount(1, FichierClients::construire());
    }

    public function test_toutes_les_periodes_sont_presentes_meme_vides(): void
    {
        Carbon::setTestNow('2026-11-30 12:00:00');
        $this->devis([], Carbon::parse('2026-11-29 09:00'));

        $courte = Pilotage::pour(Carbon::parse('2026-11-24'), Carbon::parse('2026-11-30'))['series'];
        $this->assertSame('jour', $courte['pas']);
        $this->assertCount(7, $courte['lignes']);
        $this->assertSame(1, array_sum(array_column($courte['lignes'], 'devis')));

        $this->assertSame('semaine', Pilotage::pour(Carbon::parse('2026-09-01'), Carbon::parse('2026-11-30'))['series']['pas']);

        $longue = Pilotage::pour(Carbon::parse('2026-01-01'), Carbon::parse('2026-11-30'))['series'];
        $this->assertSame('mois', $longue['pas']);
        $this->assertCount(11, $longue['lignes']);
    }

    public function test_le_delai_median_mesure_le_temps_jusqu_au_suivi(): void
    {
        Carbon::setTestNow('2026-11-30 12:00:00');
        foreach ([2, 4, 30] as $heures) {
            $d = $this->devis([], Carbon::parse('2026-11-20 08:00'));
            $d->suivi_le = Carbon::parse('2026-11-20 08:00')->addHours($heures);
            $d->save();
        }
        $this->devis([], Carbon::parse('2026-11-20 08:00'));

        $p = Pilotage::pour(Carbon::parse('2026-11-01'), Carbon::parse('2026-11-30'));

        $this->assertSame(4.0, $this->indicateur($p, 'delai_median')['valeur']);
        $this->assertSame(0.75, $this->indicateur($p, 'taux_reponse')['valeur']);
        $this->assertSame('bas', $this->indicateur($p, 'delai_median')['sens']);
    }

    public function test_les_manquements_disent_quoi_faire_et_ne_listent_que_ce_qui_existe(): void
    {
        Carbon::setTestNow('2026-11-30 12:00:00');
        config(['reservations.ouvertes' => true]);

        $this->assertSame([], Pilotage::pour(now()->subDays(29), now())['manquements']);

        $this->annonce('Sans tarif', 'Dakar', false);
        $this->devis([], now()->subHours(30));
        $recent = $this->devis();
        $recent->created_at = now()->subHours(2);
        $recent->save();

        $liste = Pilotage::pour(now()->subDays(29), now())['manquements'];
        $titres = array_column($liste, 'titre');

        $this->assertContains('1 devis en ligne sans suite depuis plus de 24 h', $titres, 'Seul le devis de plus de 24 h compte.');
        $this->assertContains('1 annonce en ligne sans aucun prix', $titres);
        $this->assertSame('haute', $liste[0]['gravite'], 'Le plus grave vient en tête.');
        foreach ($liste as $m) {
            $this->assertNotEmpty($m['conseil']);
        }
    }

    public function test_la_fermeture_de_la_reservation_est_un_manquement(): void
    {
        config(['reservations.ouvertes' => false]);

        $liste = Pilotage::pour(now()->subDays(29), now())['manquements'];

        $this->assertSame('La réservation en ligne est fermée', $liste[0]['titre']);
    }

    public function test_une_ville_demandee_sans_offre_se_voit(): void
    {
        config(['reservations.ouvertes' => true]);
        $villa = $this->annonce('Unique à Ngor', 'Ngor');
        for ($i = 0; $i < 3; $i++) {
            $this->devis(['villa_id' => $villa->id, 'suivi_le' => now()]);
        }

        $p = Pilotage::pour(now()->subDay(), now());

        $this->assertSame('Ngor', $p['villes'][0]['ville']);
        $this->assertSame(3, $p['villes'][0]['demandes']);
        $this->assertSame(3.0, $p['villes'][0]['demandes_par_annonce']);
        $this->assertContains('Ngor : 3 demandes pour 1 annonce', array_column($p['manquements'], 'titre'));
        $this->assertSame('Unique à Ngor', $p['hebergements'][0]['nom']);
        $this->assertContains('Moins de 3 photos', $p['hebergements'][0]['defauts']);
    }

    public function test_seul_l_admin_ouvre_le_pilotage_et_la_periode_est_controlee(): void
    {
        $this->getJson('/api/admin/pilotage')->assertUnauthorized();

        $this->actingAs(User::factory()->create(['role' => 'client']));
        $this->getJson('/api/admin/pilotage')->assertForbidden();

        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $reponse = $this->getJson('/api/admin/pilotage')->assertOk();
        $this->assertSame(30, $reponse->json('periode.jours'), 'Trente jours par défaut.');

        $this->getJson('/api/admin/pilotage?du=2026-11-10&au=2026-11-01')->assertStatus(422);
        $this->getJson('/api/admin/pilotage?du=2020-01-01&au=2026-11-01')->assertStatus(422);
    }
}
