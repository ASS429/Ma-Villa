<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JournalAdmin;
use App\Models\Paiement;
use App\Models\Reversement;
use App\Models\User;
use App\Services\Push;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Suivi de l'argent dû aux propriétaires.
 *
 * La plateforme encaisse tout et reverse ensuite : entre les deux, la part du
 * propriétaire était calculée, enregistrée — et invisible. Personne, ni lui ni
 * l'administrateur, ne pouvait dire ce qui restait à verser sans ouvrir un
 * historique de virements hors de l'application.
 *
 * Ce contrôleur ne déplace pas de fonds. Il répond à trois questions :
 * combien m'est dû, combien dois-je, et qu'ai-je déjà versé.
 */
class ReversementController extends Controller
{
    public function __construct(private readonly Push $push)
    {
    }

    /* ══ Côté propriétaire ════════════════════════════════════════ */

    /** Ce que le propriétaire a gagné, ce qui lui reste dû, ce qu'il a touché. */
    public function revenus(Request $request): JsonResponse
    {
        $moi = $request->user();

        // Pas de middleware dédié pour une seule route : le rôle se vérifie
        // ici. Un client obtiendrait des zéros, ce qui est exact mais laisse
        // croire qu'il devrait y avoir quelque chose.
        if ($moi->role !== 'proprietaire') {
            return response()->json([
                'message' => 'Les revenus concernent les propriétaires.',
            ], 403);
        }

        $part = fn (string $portee) => (float) Paiement::query()
            ->pourProprietaire($moi->id)
            ->{$portee}()
            ->sum('montant_proprietaire');

        // Le détail, ligne à ligne : sans lui, un total est un chiffre à croire
        // sur parole. Le propriétaire doit pouvoir remonter à la réservation.
        $lignes = Paiement::query()
            ->pourProprietaire($moi->id)
            ->abouti()
            ->with([
                'reservation:id,logement_id,date_debut,date_fin,statut',
                'reservation.logement:id,villa_id,nom',
                'reservation.logement.villa:id,nom',
            ])
            ->latest('paye_le')
            ->limit(100)
            ->get()
            ->map(fn (Paiement $p) => [
                'id'                   => $p->id,
                'reservation_id'       => $p->reservation_id,
                'villa'                => $p->reservation?->logement?->villa?->nom,
                'logement'             => $p->reservation?->logement?->nom,
                'date_debut'           => $p->reservation?->date_debut,
                'date_fin'             => $p->reservation?->date_fin,
                'paye_le'              => $p->paye_le,
                'montant_client'       => (float) $p->montant,
                'commission'           => (float) $p->commission,
                'montant_proprietaire' => (float) $p->montant_proprietaire,
                'etat'                 => $this->etat($p),
            ]);

        return response()->json([
            'a_venir'            => $part('aVenir'),
            'du'                 => $part('exigible'),
            'verse'              => (float) Reversement::where('user_id', $moi->id)->sum('montant'),
            'commission_retenue' => (float) Paiement::query()
                ->pourProprietaire($moi->id)->abouti()->sum('commission'),
            'lignes'             => $lignes,
            'reversements'       => Reversement::where('user_id', $moi->id)
                ->latest('verse_le')
                ->limit(50)
                ->get(['id', 'montant', 'methode', 'reference', 'verse_le']),
            'methodes'           => Reversement::METHODES,
        ]);
    }

    /* ══ Côté administration ══════════════════════════════════════ */

    /**
     * Qui attend son argent, et combien. Trié par montant dû décroissant :
     * c'est l'ordre dans lequel on traite la file.
     */
    public function index(): JsonResponse
    {
        $proprietaires = User::where('role', 'proprietaire')
            ->get(['id', 'name', 'email', 'phone'])
            ->map(function (User $u) {
                $du = (float) Paiement::query()->pourProprietaire($u->id)->exigible()->sum('montant_proprietaire');
                $aVenir = (float) Paiement::query()->pourProprietaire($u->id)->aVenir()->sum('montant_proprietaire');

                return [
                    'id'      => $u->id,
                    'nom'     => $u->name,
                    'email'   => $u->email,
                    'phone'   => $u->phone,
                    'du'      => $du,
                    'a_venir' => $aVenir,
                    'verse'   => (float) Reversement::where('user_id', $u->id)->sum('montant'),
                ];
            })
            // Un propriétaire sans un franc en jeu n'a rien à faire dans une
            // file d'attente de paiements.
            ->filter(fn (array $l) => $l['du'] > 0 || $l['a_venir'] > 0 || $l['verse'] > 0)
            ->sortByDesc('du')
            ->values();

        return response()->json([
            'proprietaires' => $proprietaires,
            'total_du'      => $proprietaires->sum('du'),
            'total_a_venir' => $proprietaires->sum('a_venir'),
            'derniers'      => Reversement::latest('verse_le')->limit(20)->get(),
            'methodes'      => Reversement::METHODES,
        ]);
    }

    /**
     * Enregistre un versement : solde tout ce qui est exigible pour ce
     * propriétaire, au montant calculé **par le serveur**.
     *
     * Le montant n'est jamais accepté depuis la requête. C'est le seul point
     * réellement sensible de cet écran : un champ de somme envoyé par le
     * client, c'est une écriture comptable dictée par le navigateur.
     */
    public function store(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'user_id'   => 'required|exists:users,id',
            'methode'   => 'required|in:'.implode(',', array_keys(Reversement::METHODES)),
            'reference' => 'nullable|string|max:120',
            'note'      => 'nullable|string|max:500',
        ]);

        $beneficiaire = User::findOrFail($donnees['user_id']);

        if ($beneficiaire->role !== 'proprietaire') {
            return response()->json(['message' => 'Seul un propriétaire perçoit un reversement.'], 422);
        }

        $resultat = DB::transaction(function () use ($donnees, $beneficiaire, $request) {
            // Verrouillés avant d'être sommés : sans cela, deux administrateurs
            // qui enregistrent en même temps solderaient chacun les mêmes
            // paiements, et la plateforme paierait deux fois.
            $paiements = Paiement::query()
                ->pourProprietaire($beneficiaire->id)
                ->exigible()
                ->lockForUpdate()
                ->get();

            if ($paiements->isEmpty()) {
                return null;
            }

            $montant = $paiements->sum(fn (Paiement $p) => (float) $p->montant_proprietaire);

            $reversement = Reversement::create([
                'user_id'                => $beneficiaire->id,
                'beneficiaire_nom'       => $beneficiaire->name,
                'beneficiaire_telephone' => $beneficiaire->phone,
                'montant'                => $montant,
                'methode'                => $donnees['methode'],
                'reference'              => $donnees['reference'] ?? null,
                'note'                   => $donnees['note'] ?? null,
                'verse_le'               => now(),
                'cree_par'               => $request->user()?->id,
                'createur_nom'           => $request->user()?->name,
            ]);

            // Mise à jour par le constructeur de requêtes : `reversement_id`
            // n'est pas assignable en masse, et ne doit pas le devenir.
            Paiement::whereIn('id', $paiements->pluck('id'))
                    ->update(['reversement_id' => $reversement->id]);

            return ['reversement' => $reversement, 'nombre' => $paiements->count()];
        });

        if ($resultat === null) {
            return response()->json(['message' => "Rien n'est exigible pour ce propriétaire."], 422);
        }

        JournalAdmin::consigner(
            $request->user(),
            'reversement.enregistre',
            $resultat['reversement'],
            $beneficiaire->name,
            [
                'montant'   => (float) $resultat['reversement']->montant,
                'methode'   => $resultat['reversement']->methode,
                'paiements' => $resultat['nombre'],
            ],
            $request->ip(),
        );

        // Le propriétaire apprend qu'il a été payé sans avoir à surveiller son
        // téléphone : c'est le seul moment où l'argent change de mains.
        $this->push->versUtilisateur($beneficiaire, [
            'titre'  => 'Reversement effectué',
            'corps'  => number_format((float) $resultat['reversement']->montant, 0, ',', ' ')
                        .' FCFA · '.(Reversement::METHODES[$resultat['reversement']->methode] ?? ''),
            'url'    => '/dashboard/revenus',
            'groupe' => 'reversement',
        ]);

        return response()->json($resultat['reversement'], 201);
    }

    /** L'état d'une ligne, du point de vue du propriétaire. */
    private function etat(Paiement $paiement): string
    {
        if ($paiement->reversement_id) {
            return 'verse';
        }

        if ($paiement->reservation?->statut === 'annulee') {
            return 'annule';
        }

        return $paiement->reservation && $paiement->reservation->date_fin > now()->toDateString()
            ? 'a_venir'
            : 'du';
    }
}
