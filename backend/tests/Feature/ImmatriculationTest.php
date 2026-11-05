<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\DevisController;
use App\Http\Controllers\Api\ReglementController;
use App\Models\Devis;
use App\Models\Logement;
use App\Models\Reglement;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * « Le NINEA doit obligatoirement figurer sur toutes les quittances, factures ou lettres » :
 * c'est écrit sur l'avis d'immatriculation. Ces tests gardent les documents qui sortent d'ici.
 */
class ImmatriculationTest extends TestCase
{
    use RefreshDatabase;

    private const NINEA = '013512810';

    private const RCCM = 'SN.DKR.2026.A.43219';

    private function dossier(string $langue): Reglement
    {
        Notification::fake();
        $admin = User::factory()->create(['role' => 'admin']);
        $villa = Villa::factory()->validee()->create();
        $logement = Logement::create(['villa_id' => $villa->id, 'nom' => 'Chambre', 'type' => 'chambre', 'capacite' => 2, 'disponible' => true]);
        $tarif = Tarif::create(['logement_id' => $logement->id, 'type_tarif' => 'nuitee', 'prix' => 50000, 'avec_clim' => false, 'avec_buffet' => false]);

        $devis = Devis::etablir('console', [
            'titre' => 'Séjour', 'client_nom' => 'Awa Ndiaye', 'villa_id' => $villa->id, 'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
            'date_arrivee' => now()->addDays(9)->toDateString(), 'date_depart' => now()->addDays(10)->toDateString(),
            'personnes' => 1, 'valable_jusqu_au' => now()->addDays(7)->toDateString(), 'langue' => $langue,
        ], [['designation' => 'Location', 'quantite' => 1, 'prix_unitaire' => 50000]], $admin);

        $this->actingAs($admin)->postJson("/api/admin/devis/{$devis->id}/reglements", [
            'montant' => 50000, 'moyen' => 'especes', 'recu_le' => now()->toDateString(),
        ])->assertCreated();

        return Reglement::firstOrFail();
    }

    private function verifierLesDocuments(string $langue): void
    {
        $reglement = $this->dossier($langue);
        $devis = Devis::findOrFail($reglement->devis_id);

        foreach ([view('pdf.devis', DevisController::donnees($devis))->render(), view('pdf.recu', ReglementController::donnees($reglement))->render()] as $html) {
            $this->assertStringContainsString('NINEA '.self::NINEA, $html);
            $this->assertStringContainsString('RCCM '.self::RCCM, $html);
            $this->assertStringContainsString('Arfang Souleymane Sane', $html);
        }

        // Toujours sur une page, malgré le pied qui a grandi.
        $pages = fn (string $pdf) => preg_match_all('#/Type\s*/Page[^s]#', $pdf);
        $this->assertSame(1, $pages(DevisController::rendre($devis)));
        $this->assertSame(1, $pages(ReglementController::rendre($reglement)));
    }

    public function test_le_devis_et_le_recu_en_francais_portent_le_ninea_et_le_rccm(): void
    {
        $this->verifierLesDocuments('fr');
    }

    public function test_le_devis_et_le_recu_en_anglais_portent_le_ninea_et_le_rccm(): void
    {
        $this->verifierLesDocuments('en');
    }

    public function test_les_courriels_portent_le_ninea_et_le_rccm(): void
    {
        $html = (string) (new MailMessage)->line('Bonjour')->render();

        $this->assertStringContainsString('NINEA '.self::NINEA, $html);
        $this->assertStringContainsString('RCCM '.self::RCCM, $html);
        $this->assertStringNotContainsString('All rights reserved', $html);
    }

    public function test_le_site_et_l_api_disent_la_meme_chose(): void
    {
        $chemin = base_path('../Ma-Villa/src/coordonnees.json');
        if (! is_file($chemin)) {
            $this->markTestSkipped('Le front n’est pas à côté de l’API ici.');
        }

        $site = json_decode((string) file_get_contents($chemin), true)['entreprise'];

        $this->assertSame(config('devis.emetteur.ninea'), $site['ninea']);
        $this->assertSame(config('devis.emetteur.rccm'), $site['rccm']);
        $this->assertSame(config('devis.emetteur.titulaire'), $site['titulaire']);
    }

    public function test_les_textes_publies_ne_disent_plus_en_cours_de_formalisation(): void
    {
        $chemin = base_path('../Ma-Villa/src/pages/legal/contenu.ts');
        if (! is_file($chemin)) {
            $this->markTestSkipped('Le front n’est pas à côté de l’API ici.');
        }

        $this->assertStringNotContainsString('en cours de formalisation', (string) file_get_contents($chemin));
    }
}
