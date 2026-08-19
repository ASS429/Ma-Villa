<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Message;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessagerieTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{reservation: Reservation, client: User, proprietaire: User} */
    private function decor(): array
    {
        $proprietaire = User::factory()->proprietaire()->create();
        $client = User::factory()->client()->create();

        $villa = Villa::factory()->validee()->create(['user_id' => $proprietaire->id]);
        $logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'villa_entiere',
            'capacite' => 4, 'disponible' => true,
        ]);
        $tarif = Tarif::create([
            'logement_id' => $logement->id, 'type_tarif' => 'nuitee',
            'prix' => 100000, 'avec_clim' => false, 'avec_buffet' => false,
        ]);

        $reservation = Reservation::create([
            'user_id' => $client->id, 'logement_id' => $logement->id, 'tarif_id' => $tarif->id,
            'date_debut' => now()->addDays(5)->toDateString(),
            'date_fin' => now()->addDays(8)->toDateString(),
            'nb_personnes' => 2, 'montant_total' => 300000, 'statut' => 'confirmee',
        ]);

        return compact('reservation', 'client', 'proprietaire');
    }

    /* ── Le fil ──────────────────────────────────────────────────── */

    public function test_le_client_et_le_proprietaire_echangent(): void
    {
        ['reservation' => $r, 'client' => $client, 'proprietaire' => $proprio] = $this->decor();

        $this->actingAs($client, 'sanctum')
             ->postJson("/api/reservations/{$r->id}/messages", ['corps' => 'Bonjour, à quelle heure puis-je arriver ?'])
             ->assertStatus(201);

        $this->actingAs($proprio, 'sanctum')
             ->postJson("/api/reservations/{$r->id}/messages", ['corps' => 'À partir de 14 h.'])
             ->assertStatus(201);

        $fil = $this->actingAs($client, 'sanctum')->getJson("/api/reservations/{$r->id}/messages");

        $fil->assertOk();
        $this->assertCount(2, $fil->json());
        // Du plus ancien au plus récent : une conversation se lit dans l'ordre.
        $this->assertSame('Bonjour, à quelle heure puis-je arriver ?', $fil->json('0.corps'));
        $this->assertSame('À partir de 14 h.', $fil->json('1.corps'));
        $this->assertSame($proprio->name, $fil->json('1.auteur.name'));
    }

    /* ── Accès ───────────────────────────────────────────────────── */

    /**
     * Une conversation ne concerne que trois personnes. Sans cette garde, un
     * compte quelconque lirait les échanges de n'importe qui en incrémentant
     * un identifiant.
     */
    public function test_un_tiers_ne_peut_ni_lire_ni_ecrire(): void
    {
        ['reservation' => $r] = $this->decor();
        $intrus = User::factory()->client()->create();

        $this->actingAs($intrus, 'sanctum')
             ->getJson("/api/reservations/{$r->id}/messages")
             ->assertStatus(403);

        $this->actingAs($intrus, 'sanctum')
             ->postJson("/api/reservations/{$r->id}/messages", ['corps' => 'Coucou'])
             ->assertStatus(403);

        $this->assertSame(0, Message::count());
    }

    public function test_un_proprietaire_etranger_a_la_villa_est_refuse(): void
    {
        ['reservation' => $r] = $this->decor();
        $autre = User::factory()->proprietaire()->create();

        $this->actingAs($autre, 'sanctum')
             ->getJson("/api/reservations/{$r->id}/messages")
             ->assertStatus(403);
    }

    public function test_un_visiteur_non_connecte_est_refuse(): void
    {
        ['reservation' => $r] = $this->decor();

        $this->getJson("/api/reservations/{$r->id}/messages")->assertStatus(401);
    }

    /** L'admin peut lire : c'est lui qu'on saisit en cas de litige. */
    public function test_l_admin_peut_lire_le_fil(): void
    {
        ['reservation' => $r, 'client' => $client] = $this->decor();
        $admin = User::factory()->admin()->create();

        $this->actingAs($client, 'sanctum')
             ->postJson("/api/reservations/{$r->id}/messages", ['corps' => 'Un souci avec la villa.']);

        $this->actingAs($admin, 'sanctum')
             ->getJson("/api/reservations/{$r->id}/messages")
             ->assertOk()
             ->assertJsonCount(1);
    }

    /* ── Contenu ─────────────────────────────────────────────────── */

    public function test_un_message_vide_ou_blanc_est_refuse(): void
    {
        ['reservation' => $r, 'client' => $client] = $this->decor();

        foreach (['', '   ', "\n\n"] as $corps) {
            $this->actingAs($client, 'sanctum')
                 ->postJson("/api/reservations/{$r->id}/messages", ['corps' => $corps])
                 ->assertStatus(422);
        }

        $this->assertSame(0, Message::count());
    }

    public function test_un_message_trop_long_est_refuse(): void
    {
        ['reservation' => $r, 'client' => $client] = $this->decor();

        $this->actingAs($client, 'sanctum')
             ->postJson("/api/reservations/{$r->id}/messages", ['corps' => str_repeat('a', 2001)])
             ->assertStatus(422);
    }

    /* ── Lecture et compteurs ────────────────────────────────────── */

    /**
     * Ouvrir le fil marque comme lus les messages **de l'autre**. Marquer les
     * siens ferait tomber le compteur du destinataire sans qu'il ait rien vu.
     */
    public function test_ouvrir_le_fil_ne_marque_que_les_messages_de_l_autre(): void
    {
        ['reservation' => $r, 'client' => $client, 'proprietaire' => $proprio] = $this->decor();

        $this->actingAs($client, 'sanctum')
             ->postJson("/api/reservations/{$r->id}/messages", ['corps' => 'Question du client']);
        $this->actingAs($proprio, 'sanctum')
             ->postJson("/api/reservations/{$r->id}/messages", ['corps' => 'Réponse du propriétaire']);

        // Le client ouvre : seul le message du propriétaire devient lu.
        $this->actingAs($client, 'sanctum')->getJson("/api/reservations/{$r->id}/messages");

        $duClient = Message::where('user_id', $client->id)->first();
        $duProprio = Message::where('user_id', $proprio->id)->first();

        $this->assertNull($duClient->lu_le, "Le message du client ne doit pas être marqué lu par lui-même.");
        $this->assertNotNull($duProprio->lu_le);
    }

    public function test_le_compteur_de_non_lus_ignore_ses_propres_messages(): void
    {
        ['reservation' => $r, 'client' => $client, 'proprietaire' => $proprio] = $this->decor();

        $this->actingAs($proprio, 'sanctum')
             ->postJson("/api/reservations/{$r->id}/messages", ['corps' => 'Premier']);
        $this->actingAs($proprio, 'sanctum')
             ->postJson("/api/reservations/{$r->id}/messages", ['corps' => 'Second']);

        $vuDuClient = $this->actingAs($client, 'sanctum')->getJson('/api/messages/non-lus');
        $vuDuClient->assertOk();
        $this->assertSame(2, $vuDuClient->json('total'));
        $this->assertSame(2, $vuDuClient->json("par_reservation.{$r->id}"));

        // Le propriétaire, lui, n'a rien à lire : ce sont ses propres messages.
        $vuDuProprio = $this->actingAs($proprio, 'sanctum')->getJson('/api/messages/non-lus');
        $this->assertSame(0, $vuDuProprio->json('total'));
    }

    public function test_le_compteur_ne_fuit_pas_sur_les_reservations_des_autres(): void
    {
        ['reservation' => $r, 'proprietaire' => $proprio] = $this->decor();
        $etranger = User::factory()->client()->create();

        $this->actingAs($proprio, 'sanctum')
             ->postJson("/api/reservations/{$r->id}/messages", ['corps' => 'Pour mon client']);

        $this->assertSame(
            0,
            $this->actingAs($etranger, 'sanctum')->getJson('/api/messages/non-lus')->json('total')
        );
    }

    /**
     * Une réservation annulée reste consultable et ouverte à la discussion :
     * c'est précisément là qu'un remboursement se règle, et couper la parole
     * laisserait les deux parties sans recours dans l'application.
     */
    public function test_une_reservation_annulee_reste_ouverte_a_la_discussion(): void
    {
        ['reservation' => $r, 'client' => $client] = $this->decor();
        $r->update(['statut' => 'annulee']);

        $this->actingAs($client, 'sanctum')
             ->postJson("/api/reservations/{$r->id}/messages", ['corps' => 'Et pour le remboursement ?'])
             ->assertStatus(201);
    }

    /**
     * Un auteur supprimé ne doit pas trouer la conversation des autres.
     *
     * Le cas réel est celui d'un **administrateur** intervenu dans un litige :
     * son compte peut disparaître, le fil doit rester lisible par le client et
     * le propriétaire, avec un message dont l'auteur est simplement inconnu.
     */
    public function test_le_fil_survit_a_la_suppression_de_son_auteur(): void
    {
        ['reservation' => $r, 'client' => $client] = $this->decor();
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
             ->postJson("/api/reservations/{$r->id}/messages", ['corps' => 'Nous regardons votre dossier.'])
             ->assertStatus(201);

        $admin->delete();

        $this->assertSame(1, Message::count(), "Le message ne doit pas partir avec son auteur.");
        $this->assertNull(Message::first()->user_id);

        // Et le fil reste lisible par les deux parties.
        $this->actingAs($client, 'sanctum')
             ->getJson("/api/reservations/{$r->id}/messages")
             ->assertOk()
             ->assertJsonCount(1);
    }

    /**
     * En revanche, supprimer le **propriétaire** emporte ses villas, donc ses
     * réservations, donc les fils qui s'y rattachent. C'est la cascade voulue
     * depuis l'origine : une réservation sans logement n'a plus d'objet. Le
     * test le fixe pour qu'un changement de cascade ne passe pas inaperçu.
     */
    public function test_supprimer_le_proprietaire_emporte_la_reservation_et_son_fil(): void
    {
        ['reservation' => $r, 'client' => $client, 'proprietaire' => $proprio] = $this->decor();

        $this->actingAs($client, 'sanctum')
             ->postJson("/api/reservations/{$r->id}/messages", ['corps' => 'Bonjour']);

        $proprio->delete();

        $this->assertSame(0, Message::count());
        $this->assertDatabaseMissing('reservations', ['id' => $r->id]);
    }
}
