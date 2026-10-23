<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Paiement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * La migration du 23 octobre 2026 retire les comptes de démonstration, sauf
 * ceux que de l'argent réel ou une annonce publiée rattachent à la plateforme.
 */
class RetraitDesComptesDeDemonstrationTest extends TestCase
{
    use RefreshDatabase;

    private function migrer(): void
    {
        $migration = require database_path('migrations/2026_10_23_000001_retire_les_comptes_de_demonstration.php');

        ob_start();
        $migration->up();
        ob_end_clean();
    }

    private function logementDe(User $proprietaire, string $statut = 'brouillon'): array
    {
        $villa = Villa::factory()->create(['user_id' => $proprietaire->id, 'statut' => $statut]);
        $logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'chambre', 'capacite' => 2, 'disponible' => true,
        ]);
        $tarif = Tarif::create(['logement_id' => $logement->id, 'type_tarif' => 'nuitee', 'prix' => 50000]);

        return [$villa, $logement, $tarif];
    }

    public function test_les_comptes_de_demonstration_et_leurs_brouillons_disparaissent(): void
    {
        User::factory()->admin()->create(['email' => 'moi@passetemps.sn']);
        $ancienAdmin = User::factory()->admin()->create(['email' => 'admin@mavilla.sn']);
        $proprietaire = User::factory()->proprietaire()->create(['email' => 'amadou.diallo@mavilla.sn']);
        $client = User::factory()->client()->create(['email' => 'sophie.martin@gmail.com']);
        [$villa] = $this->logementDe($proprietaire);
        $vrai = User::factory()->client()->create(['email' => 'une.vraie@cliente.sn']);

        $this->migrer();

        $this->assertNull($ancienAdmin->fresh());
        $this->assertNull($proprietaire->fresh());
        $this->assertNull($client->fresh());
        $this->assertNull($villa->fresh(), 'Le brouillon de démonstration part avec son propriétaire.');
        $this->assertNotNull($vrai->fresh(), 'Un vrai compte a été touché.');
        $this->assertTrue(User::where('email', 'moi@passetemps.sn')->exists());
    }

    public function test_un_compte_lie_a_de_l_argent_reel_est_garde(): void
    {
        $proprietaire = User::factory()->proprietaire()->create(['email' => 'fatou.ndiaye@mavilla.sn']);
        [, $logement, $tarif] = $this->logementDe($proprietaire);
        $reservation = Reservation::create([
            'user_id' => User::factory()->client()->create()->id, 'logement_id' => $logement->id,
            'tarif_id' => $tarif->id, 'date_debut' => now()->addDay()->toDateString(),
            'date_fin' => now()->addDays(2)->toDateString(), 'nb_personnes' => 1,
            'montant_total' => 50000, 'statut' => 'confirmee',
        ]);
        Paiement::create([
            'reservation_id' => $reservation->id, 'methode' => 'wave', 'montant' => 50000,
            'reference' => 'MV-REEL', 'statut' => 'reussi',
        ]);

        $this->migrer();

        $this->assertNotNull($proprietaire->fresh());
        $this->assertNotNull($reservation->fresh());
    }

    public function test_le_seul_admin_n_est_jamais_supprime(): void
    {
        $seul = User::factory()->admin()->create(['email' => 'admin@mavilla.sn']);

        $this->migrer();

        $this->assertNotNull($seul->fresh());
    }

    public function test_un_proprietaire_avec_une_annonce_publiee_est_garde(): void
    {
        $proprietaire = User::factory()->proprietaire()->create(['email' => 'ibrahima.fall@mavilla.sn']);
        $this->logementDe($proprietaire, 'validee');

        $this->migrer();

        $this->assertNotNull($proprietaire->fresh());
    }
}
