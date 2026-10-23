<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Un propriétaire ne touche qu'à ses propres logements, prix et photos.
 *
 * Les routes imbriquées vérifiaient le parent (« cette villa est-elle à
 * vous ? ») sans vérifier que l'enfant lui appartenait : en passant par sa
 * propre villa, un propriétaire modifiait, désactivait ou supprimait le
 * logement d'un autre — et la suppression emportait les réservations et les
 * paiements de la victime. Ces tests gardent la porte fermée.
 */
class CloisonnementProprietairesTest extends TestCase
{
    use RefreshDatabase;

    private User $victime;
    private User $intrus;
    private Villa $villaVictime;
    private Villa $villaIntrus;
    private Logement $logementVictime;
    private Logement $logementIntrus;
    private Tarif $tarifVictime;

    protected function setUp(): void
    {
        parent::setUp();

        $this->victime = User::factory()->proprietaire()->create();
        $this->intrus = User::factory()->proprietaire()->create();
        $this->villaVictime = Villa::factory()->validee()->create(['user_id' => $this->victime->id]);
        $this->villaIntrus = Villa::factory()->validee()->create(['user_id' => $this->intrus->id]);
        $this->logementVictime = $this->logement($this->villaVictime, 'Suite de la victime');
        $this->logementIntrus = $this->logement($this->villaIntrus, 'Chambre de l’intrus');
        $this->tarifVictime = Tarif::create([
            'logement_id' => $this->logementVictime->id,
            'type_tarif'  => 'nuitee',
            'prix'        => 80000,
        ]);
    }

    private function logement(Villa $villa, string $nom): Logement
    {
        return Logement::create([
            'villa_id'   => $villa->id,
            'nom'        => $nom,
            'type'       => 'chambre',
            'capacite'   => 2,
            'disponible' => true,
        ]);
    }

    private function enIntrus()
    {
        return $this->actingAs($this->intrus, 'sanctum');
    }

    public function test_un_proprietaire_ne_modifie_pas_le_logement_d_un_autre_par_sa_propre_villa(): void
    {
        $this->enIntrus()
            ->putJson("/api/villas/{$this->villaIntrus->id}/logements/{$this->logementVictime->id}", [
                'nom' => 'Détourné', 'type' => 'chambre', 'capacite' => 1,
            ])
            ->assertNotFound();

        $this->assertSame('Suite de la victime', $this->logementVictime->fresh()->nom);
    }

    public function test_un_proprietaire_ne_desactive_pas_le_logement_d_un_autre(): void
    {
        $this->enIntrus()
            ->patchJson("/api/villas/{$this->villaIntrus->id}/logements/{$this->logementVictime->id}/disponibilite")
            ->assertNotFound();

        $this->assertTrue((bool) $this->logementVictime->fresh()->disponible);
    }

    public function test_un_proprietaire_ne_supprime_pas_le_logement_d_un_autre(): void
    {
        $this->enIntrus()
            ->deleteJson("/api/villas/{$this->villaIntrus->id}/logements/{$this->logementVictime->id}")
            ->assertNotFound();

        $this->assertNotNull($this->logementVictime->fresh());
    }

    public function test_un_proprietaire_ne_change_pas_le_prix_d_un_autre(): void
    {
        $this->enIntrus()
            ->putJson("/api/logements/{$this->logementIntrus->id}/tarifs/{$this->tarifVictime->id}", [
                'type_tarif' => 'nuitee', 'prix' => 1,
            ])
            ->assertNotFound();

        $this->assertSame(80000, (int) $this->tarifVictime->fresh()->prix);
    }

    public function test_un_proprietaire_ne_supprime_pas_le_prix_d_un_autre(): void
    {
        $this->enIntrus()
            ->deleteJson("/api/logements/{$this->logementIntrus->id}/tarifs/{$this->tarifVictime->id}")
            ->assertNotFound();

        $this->assertNotNull($this->tarifVictime->fresh());
    }

    public function test_un_proprietaire_n_ajoute_pas_de_photo_au_logement_d_un_autre(): void
    {
        $this->enIntrus()
            ->postJson("/api/villas/{$this->villaIntrus->id}/logements/{$this->logementVictime->id}/photos", [
                'photos' => [['url' => 'https://exemple.test/intrus.jpg']],
            ])
            ->assertNotFound();

        $this->assertSame(0, $this->logementVictime->photos()->count());
    }

    public function test_un_logement_ne_se_lit_que_sous_sa_propre_villa(): void
    {
        $this->getJson("/api/villas/{$this->villaIntrus->id}/logements/{$this->logementVictime->id}")
            ->assertNotFound();
    }

    public function test_le_proprietaire_garde_la_main_sur_ses_propres_logements_et_prix(): void
    {
        $this->actingAs($this->victime, 'sanctum')
            ->putJson("/api/villas/{$this->villaVictime->id}/logements/{$this->logementVictime->id}", [
                'nom' => 'Suite rénovée', 'type' => 'chambre', 'capacite' => 3,
            ])
            ->assertOk();

        $this->actingAs($this->victime, 'sanctum')
            ->putJson("/api/logements/{$this->logementVictime->id}/tarifs/{$this->tarifVictime->id}", [
                'type_tarif' => 'nuitee', 'prix' => 90000,
            ])
            ->assertOk();

        $this->assertSame('Suite rénovée', $this->logementVictime->fresh()->nom);
        $this->assertSame(90000, (int) $this->tarifVictime->fresh()->prix);
    }
}
