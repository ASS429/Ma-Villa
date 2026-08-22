<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Avis;
use App\Models\JournalAdmin;
use App\Models\Paiement;
use App\Models\Reservation;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    /** Fenêtre des séries temporelles et des comparaisons, en jours. */
    private const FENETRE = 30;

    /**
     * Chiffres de tête de la console.
     *
     * Chaque valeur répond à une question qu'un exploitant se pose vraiment.
     * « Utilisateurs : 412 » n'en est pas une — « 412, dont 38 ce mois-ci » en
     * est une. D'où les variations : un nombre sans tendance ne dit pas s'il
     * faut agir.
     */
    public function stats(): JsonResponse
    {
        $depuis = now()->subDays(self::FENETRE);
        $precedent = now()->subDays(self::FENETRE * 2);

        // Les réservations sont comptées par statut en une seule passe : cinq
        // requêtes séparées pour cinq statuts, c'est cinq allers-retours sur un
        // serveur mono-processus.
        $parStatut = Reservation::query()
            ->select('statut', DB::raw('COUNT(*) as total'))
            ->groupBy('statut')
            ->pluck('total', 'statut');

        $villasParStatut = Villa::query()
            ->select('statut', DB::raw('COUNT(*) as total'))
            ->groupBy('statut')
            ->pluck('total', 'statut');

        return response()->json([
            'utilisateurs' => [
                'total' => User::count(),
                'nouveaux' => User::where('created_at', '>=', $depuis)->count(),
                'variation' => $this->variation(
                    User::whereBetween('created_at', [$depuis, now()])->count(),
                    User::whereBetween('created_at', [$precedent, $depuis])->count(),
                ),
                'proprietaires' => User::where('role', 'proprietaire')->count(),
                'clients' => User::where('role', 'client')->count(),
            ],

            'villas' => [
                'total' => Villa::count(),
                // Le seul chiffre qui appelle une action immédiate : c'est le
                // métier quotidien de l'administrateur.
                'en_attente' => (int) ($villasParStatut['en_attente'] ?? 0),
                'validees' => (int) ($villasParStatut['validee'] ?? 0),
                'rejetees' => (int) ($villasParStatut['rejetee'] ?? 0),
                'vedettes' => Villa::where('vedette', true)->count(),
            ],

            'reservations' => [
                'total' => array_sum($parStatut->all()),
                'en_attente' => (int) ($parStatut['en_attente'] ?? 0),
                'confirmees' => (int) ($parStatut['confirmee'] ?? 0),
                'annulees' => (int) ($parStatut['annulee'] ?? 0),
                'periode' => Reservation::where('created_at', '>=', $depuis)->count(),
                'variation' => $this->variation(
                    Reservation::whereBetween('created_at', [$depuis, now()])->count(),
                    Reservation::whereBetween('created_at', [$precedent, $depuis])->count(),
                ),
            ],

            // Deux notions distinctes, qu'il ne faut jamais confondre :
            // le volume réservé, et l'argent réellement encaissé.
            'finances' => [
                'volume_confirme' => (float) Reservation::where('statut', 'confirmee')->sum('montant_total'),
                'encaisse' => (float) Paiement::where('statut', 'reussi')->sum('montant'),
                'encaisse_periode' => (float) Paiement::where('statut', 'reussi')
                    ->where('paye_le', '>=', $depuis)->sum('montant'),
                'commission' => (float) Paiement::where('statut', 'reussi')->sum('commission'),
                'paiements_en_attente' => Paiement::where('statut', 'en_attente')->count(),
                'paiements_echoues' => Paiement::where('statut', 'echoue')->count(),
            ],

            'avis' => [
                'total' => Avis::count(),
                'periode' => Avis::where('created_at', '>=', $depuis)->count(),
                'note_moyenne' => round((float) Avis::avg('note'), 1),
            ],

            'fenetre_jours' => self::FENETRE,
        ]);
    }

    /**
     * Séries de trente jours, pour les graphiques.
     *
     * Tous les jours sont présents, y compris ceux sans donnée : une série
     * trouée se dessine comme une droite entre deux points éloignés, ce qui
     * invente une activité qui n'a pas eu lieu.
     */
    public function statistiques(): JsonResponse
    {
        $depuis = now()->subDays(self::FENETRE - 1)->startOfDay();

        $reservations = $this->parJour(Reservation::query(), 'created_at', $depuis);
        $comptes = $this->parJour(User::query(), 'created_at', $depuis);
        $encaisse = $this->parJour(
            Paiement::where('statut', 'reussi'), 'paye_le', $depuis, 'montant'
        );

        $jours = [];
        for ($i = self::FENETRE - 1; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $jours[] = [
                'date' => $date,
                'libelle' => Carbon::parse($date)->format('d/m'),
                'reservations' => (int) ($reservations[$date] ?? 0),
                'comptes' => (int) ($comptes[$date] ?? 0),
                'encaisse' => (float) ($encaisse[$date] ?? 0),
            ];
        }

        return response()->json([
            'jours' => $jours,
            // Où se trouve l'offre : c'est ce qui dit où prospecter.
            'villes' => Villa::query()
                ->select('ville', DB::raw('COUNT(*) as total'))
                ->where('statut', 'validee')
                ->groupBy('ville')
                ->orderByDesc('total')
                ->limit(8)
                ->get()
                ->map(fn ($v) => ['ville' => $v->ville, 'total' => (int) $v->total]),
        ]);
    }

    /**
     * Fil d'activité récente — ce qui vient de se passer sur la plateforme.
     *
     * Les trois flux sont ramenés séparément puis fusionnés : une union SQL
     * sur des tables aux colonnes différentes serait illisible, et le volume
     * en jeu (quinze lignes) ne le justifie pas.
     */
    public function activite(): JsonResponse
    {
        $villas = Villa::with('proprietaire:id,name')
            ->latest()->limit(6)
            ->get(['id', 'nom', 'ville', 'statut', 'user_id', 'created_at'])
            ->map(fn ($v) => [
                'type' => 'villa',
                'id' => $v->id,
                'titre' => $v->nom,
                'detail' => $v->ville.' · '.$v->proprietaire?->name,
                'statut' => $v->statut,
                'date' => $v->created_at,
            ]);

        $comptes = User::latest()->limit(6)
            ->get(['id', 'name', 'email', 'role', 'created_at'])
            ->map(fn ($u) => [
                'type' => 'compte',
                'id' => $u->id,
                'titre' => $u->name,
                'detail' => $u->email,
                'statut' => $u->role,
                'date' => $u->created_at,
            ]);

        $reservations = Reservation::with('logement.villa:id,nom', 'client:id,name')
            ->latest()->limit(6)
            ->get()
            ->map(fn ($r) => [
                'type' => 'reservation',
                'id' => $r->id,
                'titre' => $r->logement?->villa?->nom ?? 'Logement supprimé',
                'detail' => $r->client?->name.' · '.number_format((float) $r->montant_total, 0, ',', ' ').' FCFA',
                'statut' => $r->statut,
                'date' => $r->created_at,
            ]);

        return response()->json(
            $villas->concat($comptes)->concat($reservations)
                ->sortByDesc('date')
                ->take(12)
                ->values()
        );
    }

    /* ── Listes ──────────────────────────────────────────────────── */

    /**
     * Les listes sont paginées.
     *
     * Elles renvoyaient auparavant la table entière : à quelques centaines de
     * lignes cela passe, à dix mille la réponse et la mémoire du serveur
     * s'effondrent — et c'est le jour du lancement que le volume arrive.
     */
    public function villas(Request $request): JsonResponse
    {
        $request->validate([
            'statut' => 'sometimes|in:en_attente,validee,rejetee',
            'recherche' => 'sometimes|nullable|string|max:100',
            'par_page' => 'sometimes|integer|min:5|max:100',
        ]);

        $villas = Villa::with('proprietaire')
            ->where('statut', $request->input('statut', 'en_attente'))
            ->when($request->filled('recherche'), function ($q) use ($request) {
                $terme = '%'.$request->input('recherche').'%';
                $q->where(fn ($s) => $s->where('nom', 'like', $terme)->orWhere('ville', 'like', $terme));
            })
            ->latest()
            ->paginate($request->integer('par_page', 20));

        return response()->json($villas);
    }

    public function utilisateurs(Request $request): JsonResponse
    {
        $request->validate([
            'role' => 'sometimes|in:client,proprietaire,admin',
            'recherche' => 'sometimes|nullable|string|max:100',
            'par_page' => 'sometimes|integer|min:5|max:100',
        ]);

        $utilisateurs = User::query()
            ->when($request->filled('role'), fn ($q) => $q->where('role', $request->input('role')))
            ->when($request->filled('recherche'), function ($q) use ($request) {
                $terme = '%'.$request->input('recherche').'%';
                $q->where(fn ($s) => $s->where('name', 'like', $terme)->orWhere('email', 'like', $terme));
            })
            ->withCount(['villas', 'reservations'])
            ->latest()
            ->paginate($request->integer('par_page', 20));

        return response()->json($utilisateurs);
    }

    public function avis(Request $request): JsonResponse
    {
        $request->validate(['par_page' => 'sometimes|integer|min:5|max:100']);

        return response()->json(
            Avis::with(['client', 'villa'])->latest()->paginate($request->integer('par_page', 20))
        );
    }

    /* ── Actions ─────────────────────────────────────────────────── */

    /**
     * Valide, rejette, ou retire une annonce.
     *
     * **Un refus exige un motif.** C'est ce motif qui part au propriétaire et
     * au journal d'audit : un rejet sans raison produit un appel au service
     * client et une annonce que personne ne corrige jamais.
     *
     * Retirer une annonce déjà publiée emprunte le même chemin — c'est le même
     * geste, avec les mêmes conséquences pour celui qui la subit.
     */
    public function validerVilla(Request $request, Villa $villa): JsonResponse
    {
        $donnees = $request->validate([
            'statut' => 'required|in:validee,rejetee',
            // Exigé seulement au refus : valider n'a pas à se justifier.
            'motif'  => 'required_if:statut,rejetee|nullable|string|min:10|max:500',
        ], [
            'motif.required_if' => 'Dites pourquoi : le propriétaire recevra ce motif.',
            'motif.min'         => 'Un motif tient en une phrase, pas en un mot.',
        ]);

        $avant = $villa->statut;
        $villa->update(['statut' => $donnees['statut']]);

        // « Retirée » et « rejetée » sont deux gestes différents dans le
        // journal, même s'ils mènent au même statut : refuser une annonce qui
        // n'a jamais été en ligne n'a pas les mêmes suites que dépublier une
        // annonce qui recevait des réservations.
        $action = match (true) {
            $donnees['statut'] === 'validee' => 'villa.validee',
            $avant === 'validee'             => 'villa.retiree',
            default                          => 'villa.rejetee',
        };

        JournalAdmin::consigner(
            $request->user(),
            $action,
            $villa,
            $villa->nom,
            array_filter([
                'statut_avant' => $avant,
                'statut_apres' => $villa->statut,
                'motif'        => $donnees['motif'] ?? null,
            ]),
            $request->ip(),
        );

        if ($action !== 'villa.validee') {
            $this->prevenirDuRefus($villa, $donnees['motif'] ?? '', $action === 'villa.retiree');
        }

        return response()->json($villa);
    }

    /**
     * Le propriétaire apprend le refus par le produit, pas en constatant que
     * son annonce a disparu. Le motif voyage avec : sans lui, il ne peut ni
     * corriger ni contester.
     */
    private function prevenirDuRefus(Villa $villa, string $motif, bool $retiree): void
    {
        $proprietaire = $villa->proprietaire;
        if (! $proprietaire) {
            return;
        }

        app(\App\Services\Push::class)->versUtilisateur($proprietaire, [
            'titre'  => $retiree ? 'Annonce retirée' : 'Annonce refusée',
            'corps'  => $villa->nom.' — '.\Illuminate\Support\Str::limit($motif, 100),
            'url'    => '/dashboard/villas',
            'groupe' => "villa-{$villa->id}",
        ]);
    }

    public function toggleVedette(Request $request, Villa $villa): JsonResponse
    {
        $villa->update(['vedette' => ! $villa->vedette]);

        JournalAdmin::consigner(
            $request->user(),
            $villa->vedette ? 'villa.mise_en_vedette' : 'villa.retiree_vedette',
            $villa,
            $villa->nom,
            [],
            $request->ip(),
        );

        return response()->json($villa);
    }

    /**
     * Un compte administrateur ne se supprime pas depuis cet écran.
     *
     * Le bouton est à un pixel de celui des clients, et une plateforme qui
     * perd son dernier admin ne se répare plus par l'interface : validation
     * des villas, modération et sonde de paiement deviennent inatteignables.
     * Retirer un administrateur reste possible, mais en base, délibérément.
     */
    public function supprimerUtilisateur(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json([
                'message' => 'Vous ne pouvez pas supprimer votre propre compte administrateur.',
            ], 422);
        }

        if ($user->role === 'admin') {
            return response()->json([
                'message' => 'Un compte administrateur ne peut pas être supprimé depuis cet écran.',
            ], 422);
        }

        // Consigné avant la suppression : après, le nom et l'adresse ont
        // disparu, et la trace ne dirait plus qui a été fermé.
        JournalAdmin::consigner(
            $request->user(),
            'compte.supprime',
            $user,
            $user->name,
            ['email' => $user->email, 'role' => $user->role],
            $request->ip(),
        );

        $user->delete();

        return response()->json(['message' => 'Utilisateur supprimé.']);
    }

    public function supprimerAvis(Request $request, Avis $avi): JsonResponse
    {
        JournalAdmin::consigner(
            $request->user(),
            'avis.supprime',
            $avi,
            "Avis {$avi->note}/5",
            ['note' => $avi->note, 'villa_id' => $avi->villa_id, 'auteur_id' => $avi->user_id],
            $request->ip(),
        );

        $avi->delete();

        return response()->json(['message' => 'Avis supprimé.']);
    }

    /** Lecture du journal, paginée et filtrable par action. */
    public function journal(Request $request): JsonResponse
    {
        $request->validate([
            'action' => 'sometimes|nullable|string|max:60',
            'par_page' => 'sometimes|integer|min:5|max:100',
        ]);

        return response()->json(
            JournalAdmin::query()
                ->when($request->filled('action'), fn ($q) => $q->where('action', $request->input('action')))
                ->latest()
                ->paginate($request->integer('par_page', 30))
        );
    }

    /* ── Outils ──────────────────────────────────────────────────── */

    /**
     * Variation en pourcentage entre deux périodes.
     *
     * Renvoie `null` — et non zéro — quand la période précédente est vide :
     * une progression depuis rien n'a pas de sens, et « +100 % » sur un premier
     * inscrit serait un chiffre inventé.
     */
    private function variation(int $actuel, int $precedent): ?float
    {
        if ($precedent === 0) {
            return null;
        }

        return round((($actuel - $precedent) / $precedent) * 100, 1);
    }

    /**
     * Agrège une table par jour, en portable entre SQLite et PostgreSQL.
     *
     * `DATE(colonne)` n'existe pas en Postgres : la fonction équivalente est
     * `colonne::date`. Deux bugs sont déjà passés à travers cent tests parce
     * que la suite tourne sur SQLite et la production sur Postgres.
     *
     * @return array<string, float>
     */
    private function parJour($requete, string $colonne, Carbon $depuis, ?string $somme = null): array
    {
        $jour = DB::connection()->getDriverName() === 'pgsql'
            ? "{$colonne}::date"
            : "DATE({$colonne})";

        $agregat = $somme ? "SUM({$somme})" : 'COUNT(*)';

        return $requete
            ->select(DB::raw("{$jour} as jour"), DB::raw("{$agregat} as total"))
            ->where($colonne, '>=', $depuis)
            ->groupBy(DB::raw($jour))
            ->pluck('total', 'jour')
            ->all();
    }
}
