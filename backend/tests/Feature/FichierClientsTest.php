<?php

namespace Tests\Feature;

use App\Models\Commande;
use App\Models\DemandeParticuliere;
use App\Models\DemandeService;
use App\Models\Devis;
use App\Models\JournalAdmin;
use App\Models\Oeuvre;
use App\Models\User;
use App\Services\FichierClients;
use App\Services\Tableur;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Une ligne par personne, d'où qu'elle vienne : c'est ce qui permet de retrouver
 * un client venu sans compte, et de le reconnaître quand il revient.
 */
class FichierClientsTest extends TestCase
{
    use RefreshDatabase;

    private function devis(array $attributs): Devis
    {
        return Devis::etablir('site', $attributs + [
            'titre'      => 'Résidence Kabrousse',
            'client_nom' => 'Awa Ndiaye',
        ], [['designation' => 'Location', 'quantite' => 2, 'prix_unitaire' => 25000]]);
    }

    private function demande(array $attributs): DemandeParticuliere
    {
        return DemandeParticuliere::create($attributs + [
            'type'    => 'groupe',
            'message' => 'Nous serons dix.',
            'nom'     => 'Awa Ndiaye',
            'langue'  => 'fr',
        ]);
    }

    public function test_les_ecritures_d_un_meme_numero_font_une_seule_personne(): void
    {
        $this->devis(['client_telephone' => '77 123 45 67']);
        $this->devis(['client_telephone' => '+221 77 123 45 67', 'client_nom' => 'A. Ndiaye']);
        $this->demande(['telephone' => '00221771234567']);

        $clients = FichierClients::construire();

        $this->assertCount(1, $clients);
        $this->assertSame(2, $clients[0]['nombres']['devis']);
        $this->assertSame(1, $clients[0]['nombres']['demandes']);
        $this->assertSame(100000, $clients[0]['montant_devis']);
        $this->assertCount(1, $clients[0]['telephones']);
    }

    public function test_un_numero_etranger_ne_rencontre_pas_un_numero_du_pays(): void
    {
        $this->devis(['client_telephone' => '+33 7 71 23 45 67', 'client_nom' => 'Jeanne']);
        $this->devis(['client_telephone' => '77 123 45 67', 'client_nom' => 'Awa']);

        $this->assertCount(2, FichierClients::construire());
    }

    public function test_les_traces_se_rejoignent_de_proche_en_proche(): void
    {
        // Le devis donne le numéro, le compte le relie à l'adresse, la commande au compte.
        $compte = User::factory()->create([
            'role' => 'client', 'name' => 'Awa Ndiaye', 'email' => 'awa@exemple.sn', 'phone' => '771234567',
        ]);
        $this->devis(['client_telephone' => '77 123 45 67', 'client_nom' => 'Société Ndiaye']);
        $this->demande(['email' => 'AWA@exemple.sn', 'nom' => 'Awa']);
        $oeuvre = Oeuvre::create([
            'titre' => 'Masque', 'artiste' => 'Atelier Ndoye', 'categorie' => 'sculptures',
            'prix' => 10000, 'stock' => 3, 'statut' => 'publiee',
        ]);
        Commande::create([
            'user_id' => $compte->id, 'oeuvre_id' => $oeuvre->id, 'oeuvre_titre' => 'Masque', 'oeuvre_artiste' => 'Atelier Ndoye',
            'montant_oeuvre' => 10000, 'frais_livraison' => 0, 'montant_total' => 10000,
            'destinataire' => 'Autre nom', 'telephone' => '700000000',
            'zone_livraison' => 'dakar', 'adresse' => 'Rue 1', 'ville' => 'Dakar',
            'mode_paiement' => 'en_ligne', 'statut_paiement' => 'en_attente', 'statut' => 'en_attente',
        ]);

        $clients = FichierClients::construire();

        $this->assertCount(1, $clients);
        $this->assertSame('Awa Ndiaye', $clients[0]['nom'], 'Le nom du compte prime.');
        $this->assertSame($compte->id, $clients[0]['compte']['id']);
        $this->assertSame(1, $clients[0]['nombres']['commandes']);
        $this->assertContains('700000000', $clients[0]['telephones']);
    }

    public function test_notre_propre_numero_ne_relie_personne(): void
    {
        config(['reservations.contact.telephone' => '+221 75 446 90 41', 'reservations.contact.email' => 'contactptemps@gmail.com']);

        $this->devis(['client_telephone' => '75 446 90 41', 'client_nom' => 'Premier client']);
        $this->devis(['client_telephone' => '+221754469041', 'client_nom' => 'Second client', 'client_email' => 'CONTACTPTEMPS@gmail.com']);

        $this->assertCount(2, FichierClients::construire());
    }

    public function test_sans_coordonnee_on_se_rattache_au_nom_seulement(): void
    {
        $this->devis(['client_nom' => 'FAN MILK']);
        $this->devis(['client_nom' => 'fan milk']);
        $this->devis(['client_nom' => 'FAN MILK', 'client_telephone' => '77 123 45 67']);

        $this->assertCount(2, FichierClients::construire());
    }

    public function test_seuls_les_comptes_clients_ont_une_ligne(): void
    {
        User::factory()->create(['role' => 'proprietaire']);
        User::factory()->create(['role' => 'admin']);

        $this->assertSame([], FichierClients::construire());
    }

    public function test_la_console_cherche_et_filtre(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->devis(['client_telephone' => '77 123 45 67', 'client_nom' => 'Awa Ndiaye']);
        User::factory()->create(['role' => 'client', 'name' => 'Moussa Sow', 'phone' => '781112233', 'email' => 'moussa@exemple.sn']);
        DemandeService::create([
            'prestation' => 'transfert_aibd', 'date_service' => now()->addDays(5)->toDateString(),
            'personnes' => 2, 'lieu' => 'Saly', 'nom' => 'Binta Fall', 'telephone' => '76 999 88 77', 'langue' => 'fr',
        ]);

        $this->actingAs($admin);

        $tout = $this->getJson('/api/admin/clients')->assertOk();
        $tout->assertJsonPath('total', 3)->assertJsonPath('resume.sans_compte', 2)->assertJsonPath('resume.joignables', 3);

        $this->getJson('/api/admin/clients?recherche=ndiaye')->assertJsonPath('total', 1)->assertJsonPath('data.0.nom', 'Awa Ndiaye');
        // Un numéro se retrouve quelle que soit la façon de le taper.
        $this->getJson('/api/admin/clients?recherche='.urlencode('+221 76 999 88'))->assertJsonPath('data.0.nom', 'Binta Fall');
        $this->getJson('/api/admin/clients?recherche=moussa@')->assertJsonPath('data.0.nom', 'Moussa Sow');
        $this->getJson('/api/admin/clients?filtre=avec_compte')->assertJsonPath('total', 1)->assertJsonPath('data.0.nom', 'Moussa Sow');
        $this->getJson('/api/admin/clients?filtre=devis_seul')->assertJsonPath('total', 1)->assertJsonPath('data.0.nom', 'Awa Ndiaye');
    }

    public function test_seul_l_admin_voit_le_fichier(): void
    {
        $this->getJson('/api/admin/clients')->assertUnauthorized();
        $this->actingAs(User::factory()->create(['role' => 'client']));
        $this->getJson('/api/admin/clients')->assertForbidden();
        $this->getJson('/api/admin/clients/export')->assertForbidden();
    }

    public function test_l_export_est_note_au_journal_et_ne_laisse_pas_passer_de_formule(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->devis(['client_telephone' => '+221 77 123 45 67', 'client_nom' => '=HYPERLINK("http://piege","clic")']);

        $this->actingAs($admin);
        $reponse = $this->get('/api/admin/clients/export')->assertOk();
        $csv = $reponse->getContent();

        $this->assertStringStartsWith("\u{FEFF}Nom;", $csv);
        $this->assertStringContainsString('text/csv', $reponse->headers->get('Content-Type'));
        $this->assertStringContainsString("\"'=HYPERLINK(\"\"http://piege\"\",\"\"clic\"\")\"", $csv);
        $this->assertStringContainsString('00221 77 123 45 67', $csv);
        $this->assertSame(1, JournalAdmin::where('action', 'clients.exporte')->count());
    }

    public function test_une_cellule_de_tableur_reste_sure(): void
    {
        $csv = Tableur::csv(['A'], [['-2+3'], ['@x'], ['a;b'], ['ok'], [12], ['+221 77']]);

        $this->assertSame("\u{FEFF}A\r\n'-2+3\r\n'@x\r\n\"a;b\"\r\nok\r\n12\r\n00221 77\r\n", $csv);
    }
}
