<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Villa;
use App\Services\PositionApprochee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Les annonces sans coordonnées, placées au centre de leur quartier.
 *
 * 31 octobre 2026 : 6 annonces sur 57 étaient sur la carte. Une position
 * approchée vaut mieux qu'aucune, à condition de **le dire** et de ne jamais
 * écraser une position saisie.
 */
class PositionApprocheeTest extends TestCase
{
    use RefreshDatabase;

    private function villa(array $attributs = []): Villa
    {
        $villa = Villa::factory()->validee()->create(['ville' => 'Saly', 'quartier' => null, 'adresse' => 'Saly'] + $attributs);
        $villa->forceFill(['latitude' => $attributs['latitude'] ?? null, 'longitude' => $attributs['longitude'] ?? null])->save();

        return $villa->refresh();
    }

    public function test_le_centre_vient_de_l_adresse_du_quartier_puis_de_la_ville(): void
    {
        // « Virage » est dans l'adresse quand le quartier rangé dit « Yoff ».
        $this->assertSame([14.75491, -17.49553], PositionApprochee::centre('Dakar', 'Yoff', 'Virage, Almadies'));
        $this->assertSame([14.70745, -17.4744], PositionApprochee::centre('Dakar', 'Mermoz', null));
        $this->assertSame([14.44111, -17.01483], PositionApprochee::centre('Saly', 'Velingara', 'Saly'));
        $this->assertSame([14.79146, -16.92561], PositionApprochee::centre('Thiès', 'Thies', null));
        $this->assertNull(PositionApprochee::centre('Kédougou', null, null));
    }

    public function test_les_annonces_sans_position_sont_placees_et_le_disent(): void
    {
        $a = $this->villa();
        $b = $this->villa();
        $situee = $this->villa(['latitude' => 14.4, 'longitude' => -17.0]);

        $this->assertSame(2, PositionApprochee::placerCelles());

        $a->refresh(); $b->refresh(); $situee->refresh();
        $this->assertTrue($a->position_approximative);
        $this->assertEqualsWithDelta(14.44111, $a->latitude, 0.01);
        $this->assertEqualsWithDelta(-17.01483, $a->longitude, 0.01);
        // Deux annonces du même lieu ne s'empilent pas.
        $this->assertNotEquals([$a->latitude, $a->longitude], [$b->latitude, $b->longitude]);
        // Une position saisie n'est jamais déplacée, et reste exacte.
        $this->assertSame([14.4, -17.0], [$situee->latitude, $situee->longitude]);
        $this->assertFalse($situee->position_approximative);

        $this->assertSame(0, PositionApprochee::placerCelles(), 'rejouable : rien ne bouge la seconde fois');
    }

    public function test_la_fiche_dit_que_la_position_est_approchee(): void
    {
        $villa = $this->villa();
        PositionApprochee::placerCelles();

        $this->getJson("/api/villas/{$villa->id}")->assertOk()->assertJsonPath('position_approximative', true);
    }

    public function test_la_position_saisie_par_le_proprietaire_devient_exacte(): void
    {
        $villa = $this->villa();
        PositionApprochee::placerCelles();
        $villa->refresh();

        // Changer le nom seul, position renvoyée telle quelle : elle reste approchée.
        $this->actingAs(User::find($villa->user_id))->putJson("/api/villas/{$villa->id}", [
            'nom' => 'Nouveau nom', 'ville' => 'Saly', 'latitude' => $villa->latitude, 'longitude' => $villa->longitude,
        ])->assertOk();
        $this->assertTrue($villa->refresh()->position_approximative);

        $this->actingAs(User::find($villa->user_id))->putJson("/api/villas/{$villa->id}", [
            'nom' => 'Nouveau nom', 'ville' => 'Saly', 'latitude' => 14.452901, 'longitude' => -17.010001,
        ])->assertOk();
        $villa->refresh();
        $this->assertFalse($villa->position_approximative);
        $this->assertSame(14.452901, $villa->latitude);
    }

    public function test_une_annonce_validee_sans_position_est_placee(): void
    {
        $villa = $this->villa();
        $villa->forceFill(['statut' => 'en_attente'])->save();
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)->patchJson("/api/admin/villas/{$villa->id}/statut", ['statut' => 'validee'])->assertOk();

        $this->assertTrue($villa->refresh()->position_approximative);
        $this->assertNotNull($villa->latitude);
    }
}
