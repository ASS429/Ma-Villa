<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Message;
use App\Models\Photo;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * La fiche d'un compte : ce que la base sait de lui, sans le contenu de ses
 * messages ; un PDF interne noté au journal, et un catalogue sans coordonnées.
 */
class FicheUtilisateurTest extends TestCase
{
    use RefreshDatabase;

    private function proprietaire(): array
    {
        $proprio = User::factory()->proprietaire()->create(['name' => 'Clé d’Or', 'email' => 'cle@example.sn', 'phone' => '77 592 56 58']);
        $villa = Villa::factory()->validee()->create(['user_id' => $proprio->id, 'nom' => 'Résidence Sorano', 'ville' => 'Dakar']);
        $logement = Logement::create(['villa_id' => $villa->id, 'nom' => 'F4', 'type' => 'appartement', 'capacite' => 6, 'disponible' => true]);
        $tarif = Tarif::create(['logement_id' => $logement->id, 'type_tarif' => 'nuitee', 'prix' => 228000, 'avec_clim' => true, 'avec_buffet' => false]);
        Photo::create(['photoable_type' => Villa::class, 'photoable_id' => $villa->id, 'url' => 'https://photos.example/sorano.jpg', 'ordre' => 0]);

        return [$proprio, $villa, $logement, $tarif];
    }

    public function test_la_fiche_dit_ce_que_la_base_sait_sans_le_contenu_des_messages(): void
    {
        $admin = User::factory()->admin()->create();
        [$proprio, $villa, $logement, $tarif] = $this->proprietaire();
        $client = User::factory()->create(['name' => 'Awa']);
        $resa = Reservation::create([
            'user_id' => $client->id, 'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
            'date_debut' => now()->addDays(5)->toDateString(), 'date_fin' => now()->addDays(7)->toDateString(),
            'nb_personnes' => 2, 'montant_total' => 456000, 'statut' => 'confirmee',
        ]);
        Message::create(['reservation_id' => $resa->id, 'user_id' => $proprio->id, 'corps' => 'Le code du portail est 4521']);

        $reponse = $this->actingAs($admin, 'sanctum')->getJson("/api/admin/utilisateurs/{$proprio->id}/fiche")->assertOk();

        $reponse->assertJsonPath('utilisateur.phone', '77 592 56 58')
            ->assertJsonPath('chiffres.annonces', 1)
            ->assertJsonPath('chiffres.reservations_recues', 1)
            ->assertJsonPath('chiffres.messages', 1)
            ->assertJsonPath('annonces.0.nom', 'Résidence Sorano')
            ->assertJsonPath('annonces.0.prix_min', 228000)
            ->assertJsonPath('reservations_recues.0.client', 'Awa');
        $this->assertStringNotContainsString('4521', $reponse->getContent(), 'Le contenu des messages ne sort pas.');
    }

    public function test_la_fiche_interne_se_telecharge_et_se_note_au_journal(): void
    {
        $admin = User::factory()->admin()->create();
        [$proprio] = $this->proprietaire();

        $reponse = $this->actingAs($admin, 'sanctum')->get("/api/admin/utilisateurs/{$proprio->id}/documents/fiche")->assertOk();

        $this->assertSame('application/pdf', $reponse->headers->get('Content-Type'));
        $this->assertStringStartsWith('%PDF', $reponse->getContent());
        $this->assertDatabaseHas('journal_admin', ['action' => 'utilisateur.fiche_telecharge', 'cible_id' => $proprio->id]);
    }

    public function test_le_catalogue_montre_les_annonces_sans_aucune_coordonnee(): void
    {
        $admin = User::factory()->admin()->create();
        [$proprio] = $this->proprietaire();
        $image = imagecreatetruecolor(1200, 800);
        ob_start();
        imagejpeg($image);
        Http::fake(['photos.example/*' => Http::response(ob_get_clean(), 200, ['Content-Type' => 'image/jpeg'])]);

        $reponse = $this->actingAs($admin, 'sanctum')->get("/api/admin/utilisateurs/{$proprio->id}/documents/catalogue")->assertOk();
        $this->assertStringStartsWith('%PDF', $reponse->getContent());
        $this->assertStringContainsString('Catalogue-', $reponse->headers->get('Content-Disposition'));

        $html = view('pdf.catalogue', [
            'proprietaire' => $proprio,
            'annonces'     => $proprio->villas()->with(['photos', 'logements.tarifs'])->get(),
            'photos'       => [],
            'logo'         => null,
            'contact'      => ['telephone' => '+221 75 446 90 41', 'email' => 'contactptemps@gmail.com'],
        ])->render();
        $this->assertStringContainsString('Résidence Sorano', $html);
        $this->assertStringContainsString('228 000', str_replace("\u{00A0}", ' ', $html));
        $this->assertStringNotContainsString('cle@example.sn', $html);
        $this->assertStringNotContainsString('592 56 58', $html);
    }

    public function test_un_compte_sans_annonce_en_ligne_n_a_pas_de_catalogue(): void
    {
        $admin = User::factory()->admin()->create();
        $client = User::factory()->create();

        $this->actingAs($admin, 'sanctum')->get("/api/admin/utilisateurs/{$client->id}/documents/catalogue")->assertNotFound();
        $this->actingAs($admin, 'sanctum')->get("/api/admin/utilisateurs/{$client->id}/documents/inconnu")->assertNotFound();
    }

    public function test_seul_l_admin_ouvre_une_fiche(): void
    {
        [$proprio] = $this->proprietaire();

        $this->actingAs($proprio, 'sanctum')->getJson("/api/admin/utilisateurs/{$proprio->id}/fiche")->assertForbidden();
        $this->actingAs($proprio, 'sanctum')->get("/api/admin/utilisateurs/{$proprio->id}/documents/fiche")->assertForbidden();
    }
}
