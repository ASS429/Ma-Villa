<?php

namespace Tests\Feature;

use App\Models\Logement;
use App\Models\Paiement;
use App\Models\Remboursement;
use App\Models\Reservation;
use App\Models\Reversement;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Rendre l'argent au client.
 *
 * La plateforme encaisse tout, puis vire à la main — dans les deux sens. Le
 * code ne déplace donc aucun franc ; il décide de trois choses, et ce sont
 * elles qu'on fixe ici :
 *
 *   — **combien** on propose de rendre, selon qui a causé l'annulation ;
 *   — qu'on ne puisse jamais rendre **plus qu'encaissé**, quoi que dise la
 *     requête ;
 *   — qu'un client qui a payé **demande** son annulation au lieu de l'imposer,
 *     puisque c'est nous qui détenons son argent.
 */
class RemboursementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $proprietaire;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
        $this->proprietaire = User::factory()->proprietaire()->create(['phone' => '+221 77 123 45 67']);
    }

    /**
     * Un séjour payé, à `$joursAvantArrivee` de l'arrivée. Un nombre négatif
     * place l'arrivée dans le passé.
     */
    private function sejourPaye(int $montant, int $joursAvantArrivee = 30): Paiement
    {
        $villa = Villa::factory()->validee()->create(['user_id' => $this->proprietaire->id]);
        $logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'villa_entiere',
            'capacite' => 4, 'disponible' => true,
        ]);
        $tarif = Tarif::create([
            'logement_id' => $logement->id, 'type_tarif' => 'nuitee',
            'prix' => $montant, 'avec_clim' => false, 'avec_buffet' => false,
        ]);

        $debut = now()->addDays($joursAvantArrivee);

        $reservation = Reservation::create([
            'user_id' => User::factory()->client()->create()->id,
            'logement_id' => $logement->id,
            'tarif_id' => $tarif->id,
            'date_debut' => $debut->toDateString(),
            'date_fin' => $debut->copy()->addDays(3)->toDateString(),
            'nb_personnes' => 2,
            'montant_total' => $montant,
            'statut' => 'confirmee',
        ]);

        $paiement = new Paiement([
            'reservation_id' => $reservation->id,
            'methode' => 'wave',
            'statut' => 'reussi',
            'paye_le' => now(),
        ]);
        $paiement->appliquerRepartition(\App\Services\Commission::pour($montant));
        $paiement->save();

        return $paiement->refresh();
    }

    /* ── Ce qu'on propose, et pourquoi ───────────────────────────── */

    /**
     * Le cœur de la règle : quand la faute vient de nous, le client récupère
     * tout, **commission comprise**. Lui retenir notre marge sur un séjour
     * qu'on n'a pas su fournir est la meilleure façon de ne jamais le revoir.
     */
    public function test_une_faute_de_la_plateforme_rend_tout_commission_comprise(): void
    {
        $paiement = $this->sejourPaye(100000);

        $reponse = $this->actingAs($this->admin)
            ->getJson("/api/admin/reservations/{$paiement->reservation_id}/remboursement?impute_a=plateforme")
            ->assertOk();

        $reponse->assertJsonPath('montant', 100000);
        $reponse->assertJsonPath('commission_rendue', true);
    }

    /** Une faute du propriétaire coûte la même chose au client : rien. */
    public function test_une_faute_du_proprietaire_rend_aussi_tout(): void
    {
        $paiement = $this->sejourPaye(100000);

        $this->actingAs($this->admin)
            ->getJson("/api/admin/reservations/{$paiement->reservation_id}/remboursement?impute_a=proprietaire")
            ->assertOk()
            ->assertJsonPath('montant', 100000);
    }

    /**
     * Le client se désiste longtemps à l'avance : il récupère sa part entière,
     * mais **pas** la commission. La mise en relation a bien eu lieu, et
     * l'encaissement a coûté des frais que le prestataire ne rend pas.
     */
    public function test_un_desistement_lointain_rend_la_part_du_client_sans_la_commission(): void
    {
        $paiement = $this->sejourPaye(100000, joursAvantArrivee: 30);

        $reponse = $this->actingAs($this->admin)
            ->getJson("/api/admin/reservations/{$paiement->reservation_id}/remboursement?impute_a=client")
            ->assertOk();

        $reponse->assertJsonPath('montant', (int) round((float) $paiement->montant_proprietaire));
        $reponse->assertJsonPath('commission_rendue', false);
        $this->assertLessThan(100000, $reponse->json('montant'));
    }

    /** Entre deux et six jours, le barème coupe la part du client en deux. */
    public function test_un_desistement_a_trois_jours_rend_la_moitie(): void
    {
        $paiement = $this->sejourPaye(100000, joursAvantArrivee: 3);

        $attendu = (int) floor((float) $paiement->montant_proprietaire * 0.5);

        $this->actingAs($this->admin)
            ->getJson("/api/admin/reservations/{$paiement->reservation_id}/remboursement?impute_a=client")
            ->assertOk()
            ->assertJsonPath('montant', $attendu);
    }

    /**
     * La veille, plus rien. C'est le palier qui protège le propriétaire : la
     * date était bloquée, il a refusé d'autres clients pour elle.
     */
    public function test_un_desistement_de_derniere_minute_ne_rend_rien(): void
    {
        $paiement = $this->sejourPaye(100000, joursAvantArrivee: 1);

        $this->actingAs($this->admin)
            ->getJson("/api/admin/reservations/{$paiement->reservation_id}/remboursement?impute_a=client")
            ->assertOk()
            ->assertJsonPath('montant', 0);
    }

    /* ── L'enregistrement ────────────────────────────────────────── */

    public function test_enregistrer_un_remboursement_annule_la_reservation(): void
    {
        $paiement = $this->sejourPaye(100000);

        $this->actingAs($this->admin)
            ->postJson("/api/admin/reservations/{$paiement->reservation_id}/remboursement", [
                'montant' => 100000,
                'impute_a' => 'plateforme',
                'motif' => 'Le logement a brûlé la veille de l\'arrivée.',
                'commission_rendue' => true,
            ])
            ->assertCreated();

        $this->assertDatabaseHas('remboursements', [
            'reservation_id' => $paiement->reservation_id,
            'montant' => 100000,
            'impute_a' => 'plateforme',
        ]);

        // La date se libère, et la part du propriétaire cesse d'être exigible.
        $this->assertSame('annulee', Reservation::find($paiement->reservation_id)->statut);
        $this->assertSame(0.0, (float) Paiement::query()->exigible()->sum('montant_proprietaire'));
    }

    /**
     * Le garde-fou qui compte. Le montant vient de la requête — c'est une
     * décision humaine, pas un calcul — mais il reste borné par l'encaissement.
     * Sans cette borne, une faute de frappe fabrique du chiffre d'affaires
     * négatif à partir de rien.
     */
    public function test_on_ne_peut_pas_rendre_plus_que_ce_qui_a_ete_encaisse(): void
    {
        $paiement = $this->sejourPaye(100000);

        $this->actingAs($this->admin)
            ->postJson("/api/admin/reservations/{$paiement->reservation_id}/remboursement", [
                'montant' => 1000000,
                'impute_a' => 'plateforme',
                'motif' => 'Une faute de frappe sur le montant.',
            ])
            ->assertStatus(422);

        $this->assertDatabaseCount('remboursements', 0);
    }

    /** Deux remboursements partiels sont permis, leur somme ne l'est plus. */
    public function test_le_cumul_des_remboursements_partiels_reste_borne(): void
    {
        $paiement = $this->sejourPaye(100000);
        $url = "/api/admin/reservations/{$paiement->reservation_id}/remboursement";

        $this->actingAs($this->admin)->postJson($url, [
            'montant' => 60000, 'impute_a' => 'plateforme', 'motif' => 'Premier geste commercial.',
        ])->assertCreated();

        $this->actingAs($this->admin)->postJson($url, [
            'montant' => 60000, 'impute_a' => 'plateforme', 'motif' => 'Second geste, de trop.',
        ])->assertStatus(422);

        $this->assertSame(60000.0, (float) Remboursement::sum('montant'));
    }

    /**
     * Le propriétaire déjà payé : on laisse passer, mais on inscrit combien il
     * doit rendre. Refuser n'aiderait personne — l'argent est sorti dans la
     * réalité, et le logiciel qui dit non ne le fait pas revenir.
     */
    public function test_un_proprietaire_deja_paye_laisse_une_somme_a_recuperer(): void
    {
        $paiement = $this->sejourPaye(100000);

        $reversement = Reversement::create([
            'user_id' => $this->proprietaire->id,
            'beneficiaire_nom' => $this->proprietaire->name,
            'montant' => $paiement->montant_proprietaire,
            'methode' => 'wave',
            'statut' => 'manuel',
        ]);
        // Posé explicitement : `reversement_id` est hors de `$fillable`, et
        // un `update()` l'ignorerait en silence — c'est exactement le garde-fou
        // qui empêche une requête de déclarer un versement fait.
        $paiement->reversement_id = $reversement->id;
        $paiement->save();

        $this->actingAs($this->admin)
            ->postJson("/api/admin/reservations/{$paiement->reservation_id}/remboursement", [
                'montant' => 100000,
                'impute_a' => 'plateforme',
                'motif' => 'Annulation après versement au propriétaire.',
            ])
            ->assertCreated()
            ->assertJsonPath('a_recuperer_proprietaire', number_format((float) $paiement->montant_proprietaire, 2, '.', ''));
    }

    /** Le montant ne passe pas par `$fillable` : la requête ne l'écrit pas. */
    public function test_seul_un_administrateur_enregistre_un_remboursement(): void
    {
        $paiement = $this->sejourPaye(100000);
        $client = User::find(Reservation::find($paiement->reservation_id)->user_id);

        $this->actingAs($client)
            ->postJson("/api/admin/reservations/{$paiement->reservation_id}/remboursement", [
                'montant' => 100000, 'impute_a' => 'plateforme', 'motif' => 'Je me rembourse moi-même.',
            ])
            ->assertForbidden();
    }

    /** Rien d'encaissé, rien à rendre — et le message le dit plutôt que de planter. */
    public function test_une_reservation_sans_paiement_ne_rembourse_rien(): void
    {
        $paiement = $this->sejourPaye(100000);
        $paiement->update(['statut' => 'echoue']);

        $this->actingAs($this->admin)
            ->postJson("/api/admin/reservations/{$paiement->reservation_id}/remboursement", [
                'montant' => 100000, 'impute_a' => 'plateforme', 'motif' => 'Un paiement qui n\'a jamais abouti.',
            ])
            ->assertStatus(422);
    }

    /* ── Le client demande, il n'impose plus ─────────────────────── */

    /**
     * Le changement de comportement le plus visible : un client qui a payé et
     * qui annule ne libère plus la date tout seul. Sa demande est enregistrée,
     * la réservation reste confirmée, et quelqu'un tranche.
     */
    public function test_un_client_qui_a_paye_demande_l_annulation_au_lieu_de_l_imposer(): void
    {
        $paiement = $this->sejourPaye(100000);
        $reservation = Reservation::find($paiement->reservation_id);
        $client = User::find($reservation->user_id);

        $this->actingAs($client)
            ->patchJson("/api/reservations/{$reservation->id}/statut", [
                'statut' => 'annulee',
                'motif' => 'Mon vol est annulé.',
            ])
            ->assertOk();

        $reservation->refresh();
        $this->assertSame('confirmee', $reservation->statut, 'La date doit rester bloquée jusqu\'à la décision.');
        $this->assertNotNull($reservation->annulation_demandee_le);
        $this->assertSame('Mon vol est annulé.', $reservation->annulation_motif);
    }

    /**
     * Sans paiement, rien ne change : il n'y a aucun argent à rendre, donc
     * aucune décision à prendre, et faire attendre le client serait gratuit.
     */
    public function test_sans_paiement_le_client_annule_toujours_lui_meme(): void
    {
        $paiement = $this->sejourPaye(100000);
        $paiement->update(['statut' => 'en_attente']);

        $reservation = Reservation::find($paiement->reservation_id);
        $client = User::find($reservation->user_id);

        $this->actingAs($client)
            ->patchJson("/api/reservations/{$reservation->id}/statut", ['statut' => 'annulee'])
            ->assertOk();

        $this->assertSame('annulee', $reservation->refresh()->statut);
    }

    /** Enregistrer le remboursement solde la demande : elle sort de la file. */
    public function test_le_remboursement_solde_la_demande_d_annulation(): void
    {
        $paiement = $this->sejourPaye(100000);
        $reservation = Reservation::find($paiement->reservation_id);
        $reservation->update(['annulation_demandee_le' => now(), 'annulation_motif' => 'Empêchement']);

        $this->actingAs($this->admin)
            ->postJson("/api/admin/reservations/{$reservation->id}/remboursement", [
                'montant' => 50000, 'impute_a' => 'client', 'motif' => 'Désistement à trente jours.',
            ])
            ->assertCreated();

        $reservation->refresh();
        $this->assertSame('annulee', $reservation->statut);
        $this->assertNull($reservation->annulation_demandee_le);
    }

    /** La demande en attente remonte dans « Ce qui attend ». */
    public function test_la_demande_en_attente_apparait_dans_la_file_de_travail(): void
    {
        $paiement = $this->sejourPaye(100000);
        Reservation::find($paiement->reservation_id)
            ->update(['annulation_demandee_le' => now(), 'annulation_motif' => 'Empêchement']);

        $lignes = $this->actingAs($this->admin)->getJson('/api/admin/attentes')
            ->assertOk()
            ->json('lignes');

        $this->assertContains('annulations', array_column($lignes, 'cle'));
    }
}
