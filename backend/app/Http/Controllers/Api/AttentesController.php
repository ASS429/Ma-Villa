<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Avis;
use App\Models\Commande;
use App\Models\Paiement;
use App\Models\Reservation;
use App\Models\Reversement;
use App\Models\Villa;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/**
 * Ce qui attend une décision.
 *
 * L'écran d'accueil de la console listait des chiffres — combien
 * d'utilisateurs, combien de réservations. Aucun ne répond à la seule question
 * qu'un exploitant se pose en ouvrant l'application le matin : **ai-je du
 * travail ?** Pour le savoir, il fallait ouvrir neuf pages une par une, et
 * l'absence de travail coûtait le même temps que sa présence.
 *
 * Ce contrôleur rassemble tout ce qui réclame une main humaine. Trois règles
 * le gouvernent :
 *
 *   — **rien à faire produit une liste vide**, pas une liste de zéros. Une
 *     ligne « 0 annonce à valider » se lit encore, donc se paie ;
 *   — **chaque ligne dit pourquoi elle est là**, et ce qu'elle coûte si on
 *     l'ignore. Un compteur seul n'aide pas à choisir entre deux files ;
 *   — **aucune sonde réseau n'est lancée ici.** L'écran s'ouvre plusieurs fois
 *     par jour ; interroger PayDunya à chaque fois serait lent et inutile. On
 *     ne lit que ce que la configuration dit d'elle-même, et on renvoie vers
 *     la sonde complète pour le reste.
 */
class AttentesController extends Controller
{
    /** Au-delà, une annonce en attente n'est plus un délai mais un oubli. */
    private const VILLA_VIEILLE_JOURS = 3;

    /** Une note basse récente vaut examen : c'est le signalement du pauvre. */
    private const AVIS_FENETRE_JOURS = 14;

    public function __invoke(): JsonResponse
    {
        $lignes = array_values(array_filter([
            $this->annoncesAValider(),
            $this->annulationsDemandees(),
            $this->versementsDus(),
            $this->versementsEnPanne(),
            $this->commandesImpayees(),
            $this->commandesAExpedier(),
            $this->avisSeveres(),
            ...$this->sondes(),
        ]));

        // L'ordre de la file : d'abord ce qui bloque quelqu'un d'autre.
        $rang = ['urgent' => 0, 'action' => 1, 'calme' => 2];
        usort($lignes, fn ($a, $b) => $rang[$a['gravite']] <=> $rang[$b['gravite']]);

        return response()->json([
            'lignes'    => $lignes,
            'total'     => count($lignes),
            'fonds'     => $this->fonds(),
            'genere_le' => now()->toIso8601String(),
        ]);
    }

    /* ══ Les lignes ═══════════════════════════════════════════════ */

    private function annoncesAValider(): ?array
    {
        $compte = Villa::where('statut', 'en_attente')->count();

        if ($compte === 0) {
            return null;
        }

        $plusAncienne = Villa::where('statut', 'en_attente')->min('created_at');
        $jours = $plusAncienne ? (int) Carbon::parse($plusAncienne)->diffInDays(now()) : 0;
        $vieille = $jours >= self::VILLA_VIEILLE_JOURS;

        return [
            'cle'          => 'villas',
            'gravite'      => $vieille ? 'urgent' : 'action',
            'compte'       => $compte,
            'titre'        => $compte === 1
                ? 'Une annonce attend votre validation'
                : "{$compte} annonces attendent votre validation",
            'detail'       => $vieille
                ? "La plus ancienne attend depuis {$jours} jours. Un propriétaire sans réponse ne relance pas : il publie ailleurs."
                : "Tant qu'elles ne sont pas validées, elles n'existent pour personne.",
            'lien'         => '/admin/villas',
            'libelle_lien' => 'Examiner',
        ];
    }

    /**
     * Les clients qui attendent une décision sur leur argent.
     *
     * Passe avant les versements dus : quelqu'un attend d'être remboursé, et
     * chaque jour qui passe le convainc un peu plus qu'on garde sa mise.
     */
    private function annulationsDemandees(): ?array
    {
        $demandes = Reservation::whereNotNull('annulation_demandee_le')
            ->where('statut', '!=', 'annulee')
            ->get(['id', 'annulation_demandee_le']);

        if ($demandes->isEmpty()) {
            return null;
        }

        $plusVieille = $demandes->min('annulation_demandee_le');
        $jours = $plusVieille ? (int) Carbon::parse($plusVieille)->diffInDays(now()) : 0;
        $compte = $demandes->count();

        return [
            'cle'          => 'annulations',
            'gravite'      => $jours >= 2 ? 'urgent' : 'action',
            'compte'       => $compte,
            'titre'        => $compte === 1
                ? "Un client demande l'annulation de sa réservation"
                : "{$compte} clients demandent l'annulation de leur réservation",
            'detail'       => $jours > 0
                ? "La plus ancienne attend depuis {$jours} jours. Son argent est chez nous, et le silence se lit comme un refus."
                : "Leur argent est chez nous tant que la décision n'est pas prise.",
            'lien'         => '/admin/remboursements',
            'libelle_lien' => 'Décider',
        ];
    }

    private function versementsDus(): ?array
    {
        $du = (float) Paiement::query()->exigible()->sum('montant_proprietaire');

        if ($du <= 0) {
            return null;
        }

        // Combien de propriétaires, et depuis quand attend le premier. Un
        // total sans ces deux nombres ne dit pas s'il faut agir aujourd'hui.
        $proprietaires = Paiement::query()->exigible()
            ->with('reservation.logement.villa:id,user_id')
            ->get()
            ->pluck('reservation.logement.villa.user_id')
            ->filter()
            ->unique()
            ->count();

        $plusVieux = Paiement::query()->exigible()->min('paye_le');
        $jours = $plusVieux ? (int) Carbon::parse($plusVieux)->diffInDays(now()) : 0;

        $automatique = (bool) config('paiement.reversement.automatique');

        return [
            'cle'          => 'versements',
            // Sans déboursement automatique, c'est un geste manuel qui n'a
            // aucune chance de se faire tout seul : la ligne monte d'un cran.
            'gravite'      => (! $automatique || $jours >= 3) ? 'urgent' : 'action',
            'compte'       => $proprietaires,
            'montant'      => $du,
            'titre'        => $proprietaires === 1
                ? 'Un propriétaire attend son versement'
                : "{$proprietaires} propriétaires attendent leur versement",
            'detail'       => $jours > 0
                ? "Séjours terminés, argent encaissé : le plus ancien attend depuis {$jours} jours."
                : 'Séjours terminés, argent encaissé, rien de versé.',
            'lien'         => '/admin/reversements',
            'libelle_lien' => 'Verser',
        ];
    }

    /**
     * Un versement parti et jamais conclu.
     *
     * C'est le cas le plus dangereux du lot : contrairement à un versement dû,
     * personne ne le voit venir. Le propriétaire croit être payé, la
     * plateforme croit avoir payé, et seul le statut dit le contraire.
     */
    private function versementsEnPanne(): ?array
    {
        $echoues = Reversement::where('statut', 'echoue')->count();
        $enCours = Reversement::where('statut', 'en_cours')
            ->where('created_at', '<', now()->subHour())
            ->count();

        if ($echoues + $enCours === 0) {
            return null;
        }

        $morceaux = [];
        if ($echoues > 0) {
            $morceaux[] = $echoues === 1
                ? 'un versement a échoué'
                : "{$echoues} versements ont échoué";
        }
        if ($enCours > 0) {
            $morceaux[] = $enCours === 1
                ? "un versement est en cours depuis plus d'une heure"
                : "{$enCours} versements sont en cours depuis plus d'une heure";
        }

        return [
            'cle'          => 'versements_panne',
            'gravite'      => 'urgent',
            'compte'       => $echoues + $enCours,
            'titre'        => ucfirst(implode(' et ', $morceaux)),
            'detail'       => 'Le propriétaire se croit payé. Seul le statut dit le contraire.',
            'lien'         => '/admin/reversements',
            'libelle_lien' => 'Reprendre',
        ];
    }

    private function commandesImpayees(): ?array
    {
        $compte = Commande::where('mode_paiement', 'en_ligne')
            ->where('statut_paiement', '!=', 'reussi')
            ->where('statut', '!=', 'annulee')
            ->count();

        if ($compte === 0) {
            return null;
        }

        return [
            'cle'          => 'commandes_impayees',
            'gravite'      => 'action',
            'compte'       => $compte,
            'titre'        => $compte === 1
                ? "Une commande n'est pas réglée"
                : "{$compte} commandes ne sont pas réglées",
            // Le stock est le vrai coût : il est retenu dès la commande.
            'detail'       => "L'exemplaire est retenu et ne peut pas être vendu à un autre.",
            'lien'         => '/admin/commandes',
            'libelle_lien' => 'Traiter',
        ];
    }

    private function commandesAExpedier(): ?array
    {
        $compte = Commande::where('statut', 'confirmee')->count();

        if ($compte === 0) {
            return null;
        }

        return [
            'cle'          => 'commandes_expedier',
            'gravite'      => 'action',
            'compte'       => $compte,
            'titre'        => $compte === 1
                ? "Une commande attend d'être expédiée"
                : "{$compte} commandes attendent d'être expédiées",
            'detail'       => "Payées ou à régler à la livraison : dans les deux cas, l'acheteur attend.",
            'lien'         => '/admin/commandes',
            'libelle_lien' => 'Expédier',
        ];
    }

    /**
     * Les avis sévères récents.
     *
     * Il n'existe pas de signalement dans le produit — personne ne peut
     * dénoncer un avis. La note basse et récente est ce qui s'en approche le
     * plus : c'est là que se trouvent l'injure, le règlement de compte, et
     * aussi le vrai problème qu'il faut connaître avant le propriétaire.
     */
    private function avisSeveres(): ?array
    {
        $depuis = now()->subDays(self::AVIS_FENETRE_JOURS);
        $compte = Avis::where('note', '<=', 2)->where('created_at', '>=', $depuis)->count();

        if ($compte === 0) {
            return null;
        }

        return [
            'cle'          => 'avis',
            'gravite'      => 'calme',
            'compte'       => $compte,
            'titre'        => $compte === 1
                ? 'Un avis sévère a été publié'
                : "{$compte} avis sévères ont été publiés",
            'detail'       => "Une ou deux étoiles ces quinze derniers jours. À lire avant que le propriétaire n'appelle.",
            'lien'         => '/admin/avis',
            'libelle_lien' => 'Lire',
        ];
    }

    /**
     * L'état déclaré des trois sondes — sans les lancer.
     *
     * On ne teste rien ici : on lit la configuration. Une clé absente est une
     * panne certaine et gratuite à constater ; une clé présente ne prouve
     * rien, et c'est la sonde qui tranche. La ligne renvoie donc vers elle
     * plutôt que de prétendre conclure.
     */
    private function sondes(): array
    {
        $lignes = [];

        $paydunya = config('paiement.paydunya');
        $clesPaiement = filled($paydunya['cle_maitre'] ?? null)
            && filled($paydunya['cle_privee'] ?? null)
            && filled($paydunya['token'] ?? null);

        if (config('paiement.actif') && ! $clesPaiement) {
            $lignes[] = [
                'cle'          => 'sonde_paiement',
                'gravite'      => 'urgent',
                'compte'       => null,
                'titre'        => 'Le paiement est ouvert sans clés PayDunya',
                'detail'       => 'Chaque tentative de règlement échoue, et le client croit que sa banque refuse.',
                'lien'         => '/admin/paiement',
                'libelle_lien' => 'Sonder',
            ];
        }

        if (config('push.actif') && ! filled(config('push.vapid.privee'))) {
            $lignes[] = [
                'cle'          => 'sonde_notifications',
                'gravite'      => 'action',
                'compte'       => null,
                'titre'        => 'Les notifications sont activées sans clés VAPID',
                'detail'       => "Rien n'est envoyé. Les abonnements continuent pourtant de s'enregistrer.",
                'lien'         => '/admin/notifications',
                'libelle_lien' => 'Sonder',
            ];
        }

        return $lignes;
    }

    /* ══ L'argent détenu ══════════════════════════════════════════ */

    /**
     * Ce que la plateforme détient pour autrui.
     *
     * `non_versable` est le chiffre qui dit qu'une situation est intenable :
     * de l'argent encaissé, exigible, et qu'aucun automatisme ne peut rendre
     * parce que le déboursement n'est pas ouvert. Encaisser et reverser sont
     * les deux moitiés d'une même promesse ; tenir la première sans la seconde
     * se voit ici, et nulle part ailleurs.
     */
    private function fonds(): array
    {
        $exigible = (float) Paiement::query()->exigible()->sum('montant_proprietaire');
        $aVenir   = (float) Paiement::query()->aVenir()->sum('montant_proprietaire');
        $automatique = (bool) config('paiement.reversement.automatique');

        return [
            'exigible'     => $exigible,
            'a_venir'      => $aVenir,
            'detenus'      => $exigible + $aVenir,
            'non_versable' => $automatique ? 0.0 : $exigible,
            'automatique'  => $automatique,
        ];
    }
}
