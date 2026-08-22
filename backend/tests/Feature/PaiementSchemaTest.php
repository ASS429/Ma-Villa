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
use Tests\TestCase;

class PaiementSchemaTest extends TestCase
{
    use RefreshDatabase;

    private function reservation(int $montant): Reservation
    {
        $villa = Villa::factory()->validee()->create();
        $logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'villa_entiere',
            'capacite' => 6, 'disponible' => true,
        ]);
        $tarif = Tarif::create([
            'logement_id' => $logement->id, 'type_tarif' => 'nuitee',
            'prix' => $montant, 'avec_clim' => false, 'avec_buffet' => false,
        ]);

        return Reservation::create([
            'user_id' => User::factory()->client()->create()->id,
            'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
            'date_debut' => now()->addDays(5)->toDateString(),
            'date_fin' => now()->addDays(6)->toDateString(),
            'nb_personnes' => 2, 'montant_total' => $montant, 'statut' => 'en_attente',
        ]);
    }

    public function test_la_repartition_est_figee_sur_le_paiement(): void
    {
        $reservation = $this->reservation(200000);

        $paiement = new Paiement(['reservation_id' => $reservation->id, 'methode' => 'wave']);
        $paiement->appliquerRepartition(Commission::pour($reservation->montant_total));
        $paiement->save();

        $this->assertDatabaseHas('paiements', [
            'reservation_id' => $reservation->id,
            'montant' => 200000,
            'commission' => 35000,
            'montant_proprietaire' => 165000,
        ]);
        // Taux effectif : 35 000 sur 200 000.
        $this->assertEquals(0.175, (float) $paiement->fresh()->taux_commission);
    }

    public function test_un_changement_de_bareme_ne_reecrit_pas_un_paiement_passe(): void
    {
        // C'est tout l'intérêt de figer les parts : la comptabilité déjà
        // enregistrée ne doit pas bouger quand le barème évolue.
        $reservation = $this->reservation(200000);
        $paiement = new Paiement(['reservation_id' => $reservation->id, 'methode' => 'wave']);
        $paiement->appliquerRepartition(Commission::pour($reservation->montant_total));
        $paiement->save();

        config(['paiement.commission.taux_eleve' => 0.35]);

        $this->assertEquals(35000, (int) $paiement->fresh()->commission);
        // Taux effectif : 35 000 sur 200 000.
        $this->assertEquals(0.175, (float) $paiement->fresh()->taux_commission);
    }

    public function test_la_reponse_du_prestataire_n_est_pas_exposee(): void
    {
        $reservation = $this->reservation(60000);
        $paiement = Paiement::create([
            'reservation_id' => $reservation->id, 'methode' => 'orange_money',
            'montant' => 60000, 'reponse_prestataire' => ['payeur' => '+221770000000'],
        ]);

        $this->assertArrayNotHasKey('reponse_prestataire', $paiement->fresh()->toArray());
    }
}
