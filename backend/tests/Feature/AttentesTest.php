<?php

namespace Tests\Feature;

use App\Models\Avis;
use App\Models\Commande;
use App\Models\Logement;
use App\Models\Oeuvre;
use App\Models\Paiement;
use App\Models\Reservation;
use App\Models\Reversement;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * « Ce qui attend » — la file de travail de l'administration.
 *
 * Ce que ces tests protègent avant tout : **le silence quand il n'y a rien à
 * faire.** Un écran qui liste « 0 annonce à valider, 0 versement dû, 0
 * commande » se lit encore, donc se paie, et finit par ne plus être lu du
 * tout. Le jour où une ligne apparaît vraiment, personne ne la voit.
 */
class AttentesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();

        // Le socle doit être silencieux, sinon chaque test hérite d'une sonde
        // rouge et n'atteste plus que du bruit. L'environnement de test n'a ni
        // clés PayDunya ni clés VAPID — ce qui est normal, et ne se signale
        // qu'aux tests qui ouvrent explicitement le service concerné.
        config(['paiement.actif' => false, 'push.actif' => false]);
    }

    private function attentes(): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/attentes');
    }

    /** Les clés d'une réponse, dans l'ordre où l'écran les affichera. */
    private function cles(): array
    {
        return array_column($this->attentes()->json('lignes'), 'cle');
    }

    /* ── Le silence ──────────────────────────────────────────────── */

    public function test_rien_a_faire_ne_renvoie_aucune_ligne(): void
    {
        $reponse = $this->attentes();

        $reponse->assertOk();
        $this->assertSame([], $reponse->json('lignes'));
        $this->assertSame(0, $reponse->json('total'));
    }

    /* ── Qui peut regarder ───────────────────────────────────────── */

    public function test_un_proprietaire_n_accede_pas_a_la_file(): void
    {
        $proprietaire = User::factory()->proprietaire()->create();

        $this->actingAs($proprietaire, 'sanctum')
            ->getJson('/api/admin/attentes')
            ->assertForbidden();
    }

    public function test_un_visiteur_n_accede_pas_a_la_file(): void
    {
        $this->getJson('/api/admin/attentes')->assertUnauthorized();
    }

    /* ── Les annonces ────────────────────────────────────────────── */

    public function test_une_annonce_en_attente_apparait(): void
    {
        Villa::factory()->create(['statut' => 'en_attente']);

        $lignes = $this->attentes()->json('lignes');

        $this->assertCount(1, $lignes);
        $this->assertSame('villas', $lignes[0]['cle']);
        $this->assertSame(1, $lignes[0]['compte']);
        $this->assertStringContainsString('attend votre validation', $lignes[0]['titre']);
    }

    public function test_une_annonce_validee_n_attend_rien(): void
    {
        Villa::factory()->validee()->create();

        $this->assertSame([], $this->cles());
    }

    /**
     * Passé trois jours, ce n'est plus un délai de traitement mais un oubli —
     * et la ligne doit le dire, sinon elle se lit comme les autres.
     */
    public function test_une_annonce_oubliee_passe_en_urgent(): void
    {
        $villa = Villa::factory()->create(['statut' => 'en_attente']);
        // `update()` d'Eloquent réécrit `updated_at` et, ici, ignorerait la
        // date qu'on lui donne : on passe donc par le constructeur de requêtes.
        \DB::table('villas')->where('id', $villa->id)
            ->update(['created_at' => now()->subDays(5)]);

        $ligne = $this->attentes()->json('lignes.0');

        $this->assertSame('urgent', $ligne['gravite']);
        $this->assertStringContainsString('5 jours', $ligne['detail']);
    }

    /* ── L'argent dû ─────────────────────────────────────────────── */

    /** Un séjour terminé et payé : la part du propriétaire devient exigible. */
    private function sejourPaye(bool $termine, int $montant = 100000): Paiement
    {
        $proprietaire = User::factory()->proprietaire()->create();
        $villa = Villa::factory()->validee()->create(['user_id' => $proprietaire->id]);
        $logement = Logement::create([
            'villa_id' => $villa->id, 'nom' => 'Suite', 'type' => 'villa_entiere',
            'capacite' => 4, 'disponible' => true,
        ]);
        $tarif = Tarif::create([
            'logement_id' => $logement->id, 'type_tarif' => 'nuitee',
            'prix' => $montant, 'avec_clim' => false, 'avec_buffet' => false,
        ]);

        $reservation = Reservation::create([
            'user_id' => User::factory()->client()->create()->id,
            'logement_id' => $logement->id,
            'tarif_id' => $tarif->id,
            'date_debut' => $termine ? now()->subDays(6)->toDateString() : now()->addDays(4)->toDateString(),
            'date_fin' => $termine ? now()->subDays(2)->toDateString() : now()->addDays(8)->toDateString(),
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

    public function test_un_versement_du_apparait_avec_son_montant(): void
    {
        $this->sejourPaye(termine: true);

        $ligne = $this->attentes()->json('lignes.0');

        $this->assertSame('versements', $ligne['cle']);
        $this->assertSame(1, $ligne['compte']);
        $this->assertSame(85000.0, (float) $ligne['montant']);
    }

    /**
     * Le séjour n'est pas fini : l'argent est encaissé, mais le verser
     * obligerait à le réclamer si la réservation tombe.
     */
    public function test_un_sejour_a_venir_n_attend_rien(): void
    {
        $this->sejourPaye(termine: false);

        $this->assertSame([], $this->cles());
    }

    /**
     * Le chiffre du designer : encaissé, exigible, et qu'aucun automatisme ne
     * peut rendre. Il ne vaut que tant que le déboursement est fermé.
     */
    public function test_l_argent_exigible_est_dit_non_versable_sans_deboursement(): void
    {
        config(['paiement.reversement.automatique' => false]);
        $this->sejourPaye(termine: true);

        $fonds = $this->attentes()->json('fonds');

        $this->assertSame(85000.0, (float) $fonds['exigible']);
        $this->assertSame(85000.0, (float) $fonds['non_versable']);
        $this->assertFalse($fonds['automatique']);
    }

    public function test_rien_n_est_non_versable_quand_le_deboursement_est_ouvert(): void
    {
        config(['paiement.reversement.automatique' => true]);
        $this->sejourPaye(termine: true);

        $fonds = $this->attentes()->json('fonds');

        $this->assertSame(85000.0, (float) $fonds['exigible']);
        $this->assertSame(0.0, (float) $fonds['non_versable']);
    }

    /** Les fonds détenus comptent aussi ce qui n'est pas encore exigible. */
    public function test_les_fonds_detenus_couvrent_l_exigible_et_l_a_venir(): void
    {
        $this->sejourPaye(termine: true);
        $this->sejourPaye(termine: false);

        $fonds = $this->attentes()->json('fonds');

        $this->assertSame(85000.0, (float) $fonds['exigible']);
        $this->assertSame(85000.0, (float) $fonds['a_venir']);
        $this->assertSame(170000.0, (float) $fonds['detenus']);
    }

    /* ── Les versements en panne ─────────────────────────────────── */

    public function test_un_versement_echoue_remonte_en_urgent(): void
    {
        Reversement::create([
            'user_id' => User::factory()->proprietaire()->create()->id,
            'beneficiaire_nom' => 'Moussa Diop',
            'montant' => 50000, 'methode' => 'wave', 'statut' => 'echoue',
        ]);

        $ligne = $this->attentes()->json('lignes.0');

        $this->assertSame('versements_panne', $ligne['cle']);
        $this->assertSame('urgent', $ligne['gravite']);
    }

    /**
     * Un versement parti il y a trois minutes n'est pas en panne : il est en
     * route. Crier trop tôt apprend à ignorer la ligne.
     */
    public function test_un_versement_parti_a_l_instant_n_est_pas_une_panne(): void
    {
        Reversement::create([
            'user_id' => User::factory()->proprietaire()->create()->id,
            'beneficiaire_nom' => 'Moussa Diop',
            'montant' => 50000, 'methode' => 'wave', 'statut' => 'en_cours',
        ]);

        $this->assertNotContains('versements_panne', $this->cles());
    }

    public function test_un_versement_en_cours_depuis_des_heures_est_une_panne(): void
    {
        $reversement = Reversement::create([
            'user_id' => User::factory()->proprietaire()->create()->id,
            'beneficiaire_nom' => 'Moussa Diop',
            'montant' => 50000, 'methode' => 'wave', 'statut' => 'en_cours',
        ]);
        \DB::table('reversements')->where('id', $reversement->id)
            ->update(['created_at' => now()->subHours(4)]);

        $this->assertContains('versements_panne', $this->cles());
    }

    /* ── La boutique ─────────────────────────────────────────────── */

    private function commande(array $etat): Commande
    {
        $oeuvre = Oeuvre::create([
            'titre' => 'Masque ' . uniqid(), 'artiste' => 'Atelier Ndoye', 'categorie' => 'sculptures',
            'prix' => 30000, 'stock' => 3, 'statut' => 'publiee',
        ]);

        return Commande::create(array_merge([
            'user_id'         => User::factory()->client()->create()->id,
            'oeuvre_id'       => $oeuvre->id,
            'oeuvre_titre'    => $oeuvre->titre,
            'oeuvre_artiste'  => $oeuvre->artiste,
            'montant_oeuvre'  => 30000,
            'frais_livraison' => 2000,
            'montant_total'   => 32000,
            'zone_livraison'  => 'dakar',
            'destinataire'    => 'Awa Ndiaye',
            'telephone'       => '+221 77 000 00 00',
            'adresse'         => 'Sacré-Cœur 3',
            'ville'           => 'Dakar',
        ], $etat));
    }

    public function test_une_commande_en_ligne_non_reglee_apparait(): void
    {
        $this->commande([
            'mode_paiement' => 'en_ligne', 'statut_paiement' => 'en_attente', 'statut' => 'en_attente',
        ]);

        $this->assertContains('commandes_impayees', $this->cles());
    }

    /**
     * Le paiement à la livraison n'est pas un impayé : c'est le mode choisi.
     * Le confondre ferait apparaître chaque commande normale dans la file.
     */
    public function test_une_commande_payable_a_la_livraison_n_est_pas_un_impaye(): void
    {
        $this->commande([
            'mode_paiement' => 'livraison', 'statut_paiement' => 'en_attente', 'statut' => 'confirmee',
        ]);

        $cles = $this->cles();
        $this->assertNotContains('commandes_impayees', $cles);
        $this->assertContains('commandes_expedier', $cles);
    }

    public function test_une_commande_annulee_ne_reclame_plus_rien(): void
    {
        $this->commande([
            'mode_paiement' => 'en_ligne', 'statut_paiement' => 'en_attente', 'statut' => 'annulee',
        ]);

        $this->assertSame([], $this->cles());
    }

    /* ── Les avis ────────────────────────────────────────────────── */

    public function test_un_avis_severe_recent_apparait(): void
    {
        Avis::create([
            'user_id' => User::factory()->client()->create()->id,
            'villa_id' => Villa::factory()->validee()->create()->id,
            'note' => 1, 'commentaire' => 'Rien ne correspondait à l\'annonce.',
        ]);

        $ligne = collect($this->attentes()->json('lignes'))->firstWhere('cle', 'avis');

        $this->assertNotNull($ligne);
        $this->assertSame('calme', $ligne['gravite']);
    }

    public function test_un_bon_avis_n_appelle_aucune_action(): void
    {
        Avis::create([
            'user_id' => User::factory()->client()->create()->id,
            'villa_id' => Villa::factory()->validee()->create()->id,
            'note' => 5, 'commentaire' => 'Séjour parfait, propriétaire aux petits soins.',
        ]);

        $this->assertSame([], $this->cles());
    }

    public function test_un_vieil_avis_severe_est_sorti_de_la_file(): void
    {
        $avis = Avis::create([
            'user_id' => User::factory()->client()->create()->id,
            'villa_id' => Villa::factory()->validee()->create()->id,
            'note' => 2, 'commentaire' => 'La climatisation ne marchait pas.',
        ]);
        \DB::table('avis')->where('id', $avis->id)
            ->update(['created_at' => now()->subMonths(2)]);

        $this->assertSame([], $this->cles());
    }

    /* ── Les sondes, sans réseau ─────────────────────────────────── */

    /**
     * Le pire cas silencieux : le paiement est ouvert au public et aucune clé
     * n'est posée. Chaque règlement échoue, et le client croit que sa banque
     * refuse.
     */
    public function test_le_paiement_ouvert_sans_cles_est_signale(): void
    {
        config([
            'paiement.actif' => true,
            'paiement.paydunya.cle_maitre' => null,
            'paiement.paydunya.cle_privee' => null,
            'paiement.paydunya.token' => null,
        ]);

        $this->assertContains('sonde_paiement', $this->cles());
    }

    public function test_le_paiement_ferme_ne_reclame_pas_de_cles(): void
    {
        config(['paiement.actif' => false, 'paiement.paydunya.cle_maitre' => null]);

        $this->assertNotContains('sonde_paiement', $this->cles());
    }

    public function test_des_notifications_sans_cles_vapid_sont_signalees(): void
    {
        config(['push.actif' => true, 'push.vapid.privee' => '']);

        $this->assertContains('sonde_notifications', $this->cles());
    }

    /* ── L'ordre de la file ──────────────────────────────────────── */

    /**
     * Ce qui bloque quelqu'un d'autre passe devant. Un avis sévère peut
     * attendre l'après-midi ; un versement échoué, non.
     */
    public function test_l_urgent_passe_devant_le_reste(): void
    {
        Avis::create([
            'user_id' => User::factory()->client()->create()->id,
            'villa_id' => Villa::factory()->validee()->create()->id,
            'note' => 1, 'commentaire' => 'Très déçu par ce séjour.',
        ]);
        Reversement::create([
            'user_id' => User::factory()->proprietaire()->create()->id,
            'beneficiaire_nom' => 'Moussa Diop',
            'montant' => 50000, 'methode' => 'wave', 'statut' => 'echoue',
        ]);

        $this->assertSame(['versements_panne', 'avis'], $this->cles());
    }
}
