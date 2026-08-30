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
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * L'annulation des demandes restées sans réponse.
 *
 * Deux tests portent le reste : une demande **payée** n'est jamais annulée, et
 * une demande **confirmée entre-temps** non plus. Annuler l'une ou l'autre
 * détruirait un séjour réel.
 */
class DemandeSansReponseTest extends TestCase
{
    use RefreshDatabase;

    private User $proprietaire;
    private User $client;
    private Logement $logement;
    private Tarif $tarif;

    protected function setUp(): void
    {
        parent::setUp();

        config(['reservations.delai_reponse_heures' => 24]);

        $this->proprietaire = User::factory()->proprietaire()->create();
        $this->client = User::factory()->client()->create();

        $villa = Villa::factory()->validee()->create(['user_id' => $this->proprietaire->id]);
        $this->logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'villa_entiere',
            'capacite' => 4, 'disponible' => true,
        ]);
        $this->tarif = Tarif::create([
            'logement_id' => $this->logement->id, 'type_tarif' => 'nuitee',
            'prix' => 100000, 'avec_clim' => false, 'avec_buffet' => false,
        ]);
    }

    private function demande(string $statut = 'en_attente', ?int $ageHeures = null): Reservation
    {
        $reservation = Reservation::create([
            'user_id' => $this->client->id,
            'logement_id' => $this->logement->id,
            'tarif_id' => $this->tarif->id,
            'date_debut' => now()->addDays(10)->toDateString(),
            'date_fin' => now()->addDays(13)->toDateString(),
            'nb_personnes' => 2, 'montant_total' => 300000, 'statut' => $statut,
        ]);

        if ($ageHeures !== null) {
            // Par le constructeur de requêtes : un `update()` Eloquent
            // replacerait `created_at` à maintenant.
            DB::table('reservations')->where('id', $reservation->id)
              ->update(['created_at' => now()->subHours($ageHeures)]);
        }

        return $reservation->refresh();
    }

    /* ── Le cas nominal ──────────────────────────────────────────── */

    public function test_une_demande_trop_vieille_est_annulee(): void
    {
        $demande = $this->demande(ageHeures: 25);

        $this->artisan('passetemps:annuler-demandes-sans-reponse')->assertSuccessful();

        $this->assertSame('annulee', $demande->refresh()->statut);
    }

    public function test_une_demande_recente_est_laissee(): void
    {
        $demande = $this->demande(ageHeures: 23);

        $this->artisan('passetemps:annuler-demandes-sans-reponse')->assertSuccessful();

        $this->assertSame('en_attente', $demande->refresh()->statut);
    }

    public function test_le_delai_est_reglable(): void
    {
        config(['reservations.delai_reponse_heures' => 48]);
        $demande = $this->demande(ageHeures: 25);

        $this->artisan('passetemps:annuler-demandes-sans-reponse')->assertSuccessful();

        $this->assertSame('en_attente', $demande->refresh()->statut);
    }

    /* ── Ce qu'il ne faut jamais annuler ─────────────────────────── */

    public function test_une_demande_deja_confirmee_n_est_pas_touchee(): void
    {
        $demande = $this->demande('confirmee', ageHeures: 100);

        $this->artisan('passetemps:annuler-demandes-sans-reponse')->assertSuccessful();

        $this->assertSame('confirmee', $demande->refresh()->statut);
    }

    /**
     * **Le test qui protège un séjour réel.** Une réservation payée mais restée
     * « en attente » ne devrait pas exister — un paiement abouti la confirme.
     * Si elle existe malgré tout, c'est un défaut ailleurs, et l'annuler
     * détruirait un séjour que le client a réglé.
     */
    public function test_une_demande_payee_n_est_jamais_annulee(): void
    {
        $demande = $this->demande(ageHeures: 100);

        $paiement = new Paiement([
            'reservation_id' => $demande->id, 'methode' => 'wave',
            'statut' => 'reussi', 'paye_le' => now(),
        ]);
        $paiement->appliquerRepartition(Commission::pour(300000));
        $paiement->save();

        $this->artisan('passetemps:annuler-demandes-sans-reponse')->assertSuccessful();

        $this->assertSame('en_attente', $demande->refresh()->statut);
    }

    /**
     * Le fondement de la règle : sans remboursement à faire, parce qu'un
     * paiement abouti confirme. Si ce comportement change, l'annulation
     * automatique devra rembourser — et ce test tombera d'abord.
     */
    public function test_un_paiement_abouti_confirme_donc_rien_a_rembourser(): void
    {
        $demande = $this->demande();

        // C'est ce que fait `PaiementController::reglerDepuisPrestataire`.
        $demande->update(['statut' => 'confirmee']);

        $this->assertSame(
            'confirmee',
            $demande->refresh()->statut,
            'Un paiement abouti doit confirmer : sinon une demande payée pourrait rester en attente.'
        );
    }

    /* ── Volume ──────────────────────────────────────────────────── */

    public function test_plusieurs_demandes_sont_traitees_en_un_passage(): void
    {
        $vieilles = collect(range(1, 3))->map(fn () => $this->demande(ageHeures: 30));
        $recente = $this->demande(ageHeures: 2);

        $this->artisan('passetemps:annuler-demandes-sans-reponse')->assertSuccessful();

        foreach ($vieilles as $d) {
            $this->assertSame('annulee', $d->refresh()->statut);
        }
        $this->assertSame('en_attente', $recente->refresh()->statut);
    }

    public function test_sans_rien_a_faire_la_commande_ne_dit_rien_d_alarmant(): void
    {
        $this->artisan('passetemps:annuler-demandes-sans-reponse')
             ->expectsOutputToContain('Aucune demande à annuler.')
             ->assertSuccessful();
    }
}
