<?php

namespace Tests\Feature;

use App\Models\DemandeService;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * L'Outlander et ses trois prestations : ce que le public voit, ce qui reste à l'équipe,
 * et les heures du chauffeur, tenues par le serveur.
 */
class TransportVehiculeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        config(['prestations.familles.transport.actif' => true]);
    }

    private function demande(array $enPlus = [])
    {
        return $this->postJson('/api/demandes-service', $enPlus + [
            'prestation'   => 'trajet_villes',
            'date_service' => now()->addDays(2)->toDateString(),
            'heure'        => '09:30',
            'personnes'    => 3,
            'lieu'         => 'Thiès, gare routière',
            'nom'          => 'Awa Ndiaye',
            'telephone'    => '+221 76 111 22 33',
        ]);
    }

    public function test_le_catalogue_montre_le_vehicule_et_ses_prix_commission_comprise(): void
    {
        $reponse = $this->getJson('/api/prestations')->assertOk();
        $prix = collect($reponse->json('catalogue'))->pluck('prix_a_partir_de', 'cle');

        $this->assertSame(35000, $prix['transfert_aibd']);
        $this->assertSame(35000, $prix['trajet_villes']);
        $this->assertSame(40000, $prix['location_sans_chauffeur']);

        $vehicule = $reponse->json('vehicules.outlander');
        $this->assertSame('Mitsubishi Outlander Sport', $vehicule['nom']);
        $this->assertCount(5, $vehicule['photos']);
        $this->assertSame("Gratuite jusqu'à 24 h avant", $vehicule['annulation']['fr']);
    }

    public function test_la_part_du_prestataire_et_son_nom_ne_sortent_jamais(): void
    {
        $corps = $this->getJson('/api/prestations')->assertOk()->getContent();

        $this->assertStringNotContainsString('prix_prestataire', $corps);
        $this->assertStringNotContainsString('Mamadou', $corps);
        $this->assertStringNotContainsString('delai_min_heures', $corps);
    }

    public function test_les_photos_existent_dans_le_site(): void
    {
        foreach (config('prestations.vehicules.outlander.photos') as $photo) {
            $this->assertFileExists(base_path('../Ma-Villa/public'.$photo['src']));
        }
    }

    public function test_une_demande_dans_les_heures_passe(): void
    {
        $this->demande()->assertCreated();
        $this->assertSame(1, DemandeService::count());
    }

    public function test_hors_des_heures_du_chauffeur_la_demande_se_refuse(): void
    {
        $this->demande(['heure' => '04:30'])->assertStatus(422)->assertJsonValidationErrors('heure');
        $this->demande(['heure' => '05:59'])->assertStatus(422);
        $this->demande(['heure' => '23:30'])->assertCreated();
        $this->demande(['heure' => '00:15', 'langue' => 'en'])->assertStatus(422)
            ->assertJsonPath('message', 'This car runs from 6 am to midnight.');
    }

    public function test_moins_de_deux_heures_avant_la_demande_se_refuse(): void
    {
        $this->travelTo(now()->setTime(10, 0));

        $this->demande(['date_service' => now()->toDateString(), 'heure' => '11:00'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Ce trajet se réserve au moins 2 h à l’avance, idéalement la veille.');
        $this->demande(['date_service' => now()->toDateString(), 'heure' => '12:30'])->assertCreated();
    }

    public function test_sans_heure_l_equipe_la_fixe_avec_le_client(): void
    {
        $this->demande(['heure' => null, 'date_service' => now()->toDateString()])->assertCreated();
    }

    public function test_un_service_sans_vehicule_garde_ses_regles(): void
    {
        $this->demande(['prestation' => 'chauffeur', 'heure' => '04:00'])->assertCreated();
    }

    public function test_la_console_dit_ce_qui_revient_au_prestataire_et_a_nous(): void
    {
        $this->demande(['prestation' => 'location_sans_chauffeur'])->assertCreated();
        $admin = User::factory()->admin()->create();

        $ligne = $this->actingAs($admin)->getJson('/api/admin/demandes-service')->assertOk()->json('data.0');

        $this->assertSame(['prestataire' => 'Mamadou', 'prix' => 40000, 'prix_prestataire' => 35000, 'commission' => 5000], $ligne['repartition']);
    }

    public function test_chaque_prestation_du_vehicule_prend_cinq_mille_francs(): void
    {
        foreach (config('prestations.catalogue') as $cle => $p) {
            if (($p['vehicule'] ?? null) === 'outlander') {
                $this->assertSame(5000, $p['prix_a_partir_de'] - $p['prix_prestataire'], $cle);
            }
        }
    }
}
