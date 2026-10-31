<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * La réservation rouverte, sauf sur les annonces des associés.
 *
 * Décision de l'exploitant du 31 octobre 2026 : la réservation en ligne pour
 * toutes les annonces, mais « pour nos annonces à nous », contacter
 * directement Abdou Ndour. Ce sont les annonces du circuit des associés :
 * plusieurs de leurs comptes n'ont aucune boîte aux lettres, et une demande
 * en ligne n'y serait lue par personne.
 *
 * Même règle que la suspension générale : le refus est côté serveur, et son
 * message porte le contact, parce que l'application mobile déjà distribuée
 * n'affiche que lui.
 */
class AnnoncesDeLEquipeTest extends TestCase
{
    use RefreshDatabase;

    private User $client;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'reservations.ouvertes'          => true,
            'reservations.associes_ouvertes' => false,
            'reservations.contact.nom'       => 'Abdou Ndour',
            'reservations.contact.telephone' => '+221 77 868 47 23',
            'reservations.contact.email'     => 'ndourabdou011@gmail.com',
            'paiement.actif'                 => true,
        ]);

        $this->client = User::factory()->client()->create();
    }

    /** Une annonce validée et son logement, sur le circuit voulu. */
    private function logement(string $circuit): Logement
    {
        $villa = Villa::factory()->validee()->create([
            'user_id' => User::factory()->proprietaire()->create()->id,
        ]);
        $villa->forceFill(['circuit' => $circuit, 'majoration' => $circuit === 'associe' ? 0.14 : null])->save();

        $logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'villa_entiere',
            'capacite' => 4, 'disponible' => true,
        ]);
        Tarif::create([
            'logement_id' => $logement->id, 'type_tarif' => 'nuitee',
            'prix' => 57000, 'avec_clim' => false, 'avec_buffet' => false,
        ]);

        return $logement->load('tarifs');
    }

    /** @return array<string, mixed> */
    private function demande(Logement $logement): array
    {
        return [
            'logement_id'  => $logement->id,
            'tarif_id'     => $logement->tarifs->first()->id,
            'date_debut'   => now()->addDays(10)->toDateString(),
            'date_fin'     => now()->addDays(12)->toDateString(),
            'nb_personnes' => 2,
        ];
    }

    public function test_une_annonce_des_associes_renvoie_vers_l_equipe(): void
    {
        $reponse = $this->actingAs($this->client)
            ->postJson('/api/reservations', $this->demande($this->logement('associe')))
            ->assertStatus(503)
            ->assertJsonPath('aupres_de_l_equipe', true)
            ->assertJsonPath('contact.nom', 'Abdou Ndour');

        // Ni « suspendue » ni « bientôt » : la réservation est ouverte, cette
        // annonce-ci se réserve simplement autrement.
        $this->assertStringContainsString('auprès de notre équipe', $reponse->json('message'));
        $this->assertStringContainsString('+221 77 868 47 23', $reponse->json('message'));
        $this->assertStringNotContainsString('suspendue', $reponse->json('message'));

        $this->assertDatabaseCount('reservations', 0);
    }

    public function test_une_annonce_ordinaire_se_reserve_en_ligne(): void
    {
        $this->actingAs($this->client)
            ->postJson('/api/reservations', $this->demande($this->logement('direct')))
            ->assertCreated();
    }

    /** Une demande antérieure sur une annonce des associés ne se règle pas en ligne. */
    public function test_le_reglement_en_ligne_d_une_annonce_des_associes_est_refuse(): void
    {
        $logement = $this->logement('associe');
        $reservation = Reservation::create($this->demande($logement) + [
            'user_id' => $this->client->id, 'montant_total' => 114000, 'statut' => 'confirmee',
        ]);

        $this->actingAs($this->client)
            ->postJson("/api/reservations/{$reservation->id}/paiement", [
                'methode' => 'wave', 'telephone' => '+221 77 000 00 00',
            ])
            ->assertStatus(503)
            ->assertJsonPath('aupres_de_l_equipe', true);

        $this->assertDatabaseCount('paiements', 0);
    }

    /** Fermée pour tous, la réservation l'est avec le message de la suspension. */
    public function test_la_fermeture_generale_l_emporte(): void
    {
        config(['reservations.ouvertes' => false]);

        $reponse = $this->actingAs($this->client)
            ->postJson('/api/reservations', $this->demande($this->logement('associe')))
            ->assertStatus(503);

        $this->assertStringContainsString('suspendue', $reponse->json('message'));
        $this->assertNull($reponse->json('aupres_de_l_equipe'));
    }

    public function test_ouvrir_le_circuit_des_associes_tient_en_une_variable(): void
    {
        config(['reservations.associes_ouvertes' => true]);

        $this->actingAs($this->client)
            ->postJson('/api/reservations', $this->demande($this->logement('associe')))
            ->assertCreated();

        $this->getJson('/api/configuration')->assertJsonPath('reservations.associes_ouvertes', true);
    }

    public function test_la_configuration_et_les_listes_disent_quelles_annonces_vont_a_l_equipe(): void
    {
        $this->getJson('/api/configuration')
            ->assertJsonPath('reservations.ouvertes', true)
            ->assertJsonPath('reservations.associes_ouvertes', false);

        // « Mes réservations » doit savoir s'il propose « Régler » ou le contact.
        $logement = $this->logement('associe');
        Reservation::create($this->demande($logement) + [
            'user_id' => $this->client->id, 'montant_total' => 114000, 'statut' => 'en_attente',
        ]);

        $this->actingAs($this->client)->getJson('/api/reservations')
            ->assertOk()
            ->assertJsonPath('0.logement.villa.encaisse_par_la_plateforme', true)
            ->assertJsonMissingPath('0.logement.villa.circuit');
    }

    /** Fermé par défaut dans le fichier livré : ouvrir est une décision. */
    public function test_le_circuit_des_associes_est_ferme_par_defaut(): void
    {
        $this->assertStringContainsString(
            "env('RESERVATIONS_ASSOCIES_OUVERTES', false)",
            file_get_contents(config_path('reservations.php')),
        );
    }
}
