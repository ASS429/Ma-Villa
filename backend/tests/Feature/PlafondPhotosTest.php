<?php

namespace Tests\Feature;

use App\Models\Oeuvre;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Le plafond de photos par annonce.
 *
 * Un plafond et non un plancher : sur ce marché la data est payée au volume, et
 * chaque photo est payée deux fois — à l'envoi par le propriétaire, au
 * chargement par chaque visiteur.
 *
 * Le cas qui compte est le **cumul** : un plafond vérifié envoi par envoi se
 * franchit en envoyant une photo à la fois.
 */
class PlafondPhotosTest extends TestCase
{
    use RefreshDatabase;

    private User $proprietaire;
    private Villa $villa;

    protected function setUp(): void
    {
        parent::setUp();

        config(['annonces.photos_max' => 5]);

        $this->proprietaire = User::factory()->proprietaire()->create();
        $this->villa = Villa::factory()->validee()->create(['user_id' => $this->proprietaire->id]);
    }

    /** @return array<string, mixed> */
    private function lot(int $combien): array
    {
        return ['photos' => array_map(
            fn ($i) => ['url' => "https://exemple.test/p{$i}.jpg", 'alt' => "photo {$i}", 'ordre' => $i],
            range(0, $combien - 1),
        )];
    }

    public function test_un_envoi_dans_le_plafond_passe(): void
    {
        $this->actingAs($this->proprietaire, 'sanctum')
             ->postJson("/api/villas/{$this->villa->id}/photos", $this->lot(5))
             ->assertStatus(201);

        $this->assertSame(5, $this->villa->photos()->count());
    }

    public function test_un_envoi_qui_depasse_est_refuse_en_entier(): void
    {
        $this->actingAs($this->proprietaire, 'sanctum')
             ->postJson("/api/villas/{$this->villa->id}/photos", $this->lot(6))
             ->assertStatus(422);

        // Rien n'est enregistré : un envoi partiel laisserait le propriétaire
        // deviner lesquelles sont passées.
        $this->assertSame(0, $this->villa->photos()->count());
    }

    /**
     * Le cas qui a motivé le compte sur le total : cinq envois d'une photo
     * franchissent un plafond vérifié envoi par envoi sans jamais le dépasser.
     */
    public function test_le_plafond_porte_sur_le_total_detenu(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->actingAs($this->proprietaire, 'sanctum')
                 ->postJson("/api/villas/{$this->villa->id}/photos", $this->lot(1))
                 ->assertStatus(201);
        }

        $this->actingAs($this->proprietaire, 'sanctum')
             ->postJson("/api/villas/{$this->villa->id}/photos", $this->lot(1))
             ->assertStatus(422);

        $this->assertSame(5, $this->villa->photos()->count());
    }

    /** Le message dit de combien il reste de place, pas seulement que c'est trop. */
    public function test_le_refus_dit_combien_il_reste_de_place(): void
    {
        $this->actingAs($this->proprietaire, 'sanctum')
             ->postJson("/api/villas/{$this->villa->id}/photos", $this->lot(4));

        $reponse = $this->actingAs($this->proprietaire, 'sanctum')
                        ->postJson("/api/villas/{$this->villa->id}/photos", $this->lot(3));

        $reponse->assertStatus(422);
        $this->assertStringContainsString('1 photo', $reponse->json('message'));
    }

    public function test_le_refus_a_plafond_plein_propose_de_supprimer(): void
    {
        $this->actingAs($this->proprietaire, 'sanctum')
             ->postJson("/api/villas/{$this->villa->id}/photos", $this->lot(5));

        $reponse = $this->actingAs($this->proprietaire, 'sanctum')
                        ->postJson("/api/villas/{$this->villa->id}/photos", $this->lot(1));

        $this->assertStringContainsString('Supprimez-en une', $reponse->json('message'));
    }

    /** Supprimer libère une place : le plafond n'est pas un compteur à sens unique. */
    public function test_supprimer_libere_une_place(): void
    {
        $this->actingAs($this->proprietaire, 'sanctum')
             ->postJson("/api/villas/{$this->villa->id}/photos", $this->lot(5));

        $photo = $this->villa->photos()->first();

        $this->actingAs($this->proprietaire, 'sanctum')
             ->deleteJson("/api/villas/{$this->villa->id}/photos/{$photo->id}")
             ->assertOk();

        $this->actingAs($this->proprietaire, 'sanctum')
             ->postJson("/api/villas/{$this->villa->id}/photos", $this->lot(1))
             ->assertStatus(201);
    }

    /** Le même plafond s'applique aux articles de la boutique. */
    public function test_le_plafond_vaut_aussi_pour_un_article(): void
    {
        config(['boutique.actif' => true]);

        $oeuvre = Oeuvre::create([
            'titre' => 'Tam-tam', 'artiste' => 'Modou Gueye', 'categorie' => 'sculptures',
            'prix' => 95000, 'stock' => 1, 'statut' => 'publiee',
        ]);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
             ->postJson("/api/admin/oeuvres/{$oeuvre->id}/photos", $this->lot(6))
             ->assertStatus(422);

        $this->assertSame(0, $oeuvre->photos()->count());
    }
}
