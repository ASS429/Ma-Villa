<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JournalAdmin;
use App\Models\Paiement;
use App\Models\Reversement;
use App\Models\User;
use App\Services\Deboursement;
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
    public function __construct(
        private readonly Push $push,
        private readonly Deboursement $deboursement,
    ) {
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
            // Seuls les versements aboutis comptent : afficher un versement en
            // cours comme recu ferait chercher au proprietaire un argent qui
            // n'est pas encore sur son telephone.
            'verse'              => (float) Reversement::where('user_id', $moi->id)
                ->whereIn('statut', ['manuel', 'reussi'])->sum('montant'),
            'commission_retenue' => (float) Paiement::query()
                ->pourProprietaire($moi->id)->abouti()->sum('commission'),
            'lignes'             => $lignes,
            'reversements'       => Reversement::where('user_id', $moi->id)
                ->latest()
                ->limit(50)
                ->get(['id', 'montant', 'methode', 'statut', 'reference', 'verse_le']),
            'methodes'           => Reversement::METHODES,
            'statuts'            => Reversement::STATUTS,
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
                    'verse'   => (float) Reversement::where('user_id', $u->id)
                                    ->whereIn('statut', ['manuel', 'reussi'])->sum('montant'),
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
            // Les derniers par date de creation : un versement en cours n'a pas
            // encore de date de versement, et trier sur elle le renverrait tout
            // au fond, la ou personne ne verra qu'il attend.
            'derniers'      => Reversement::latest()->limit(20)->get(),
            'methodes'      => Reversement::METHODES,
            'statuts'       => Reversement::STATUTS,
            // Dit a l'ecran s'il peut proposer l'envoi automatique. Le proposer
            // quand PayDunya n'a pas ouvert l'option ne produirait qu'un refus.
            'automatique'   => $this->deboursement->disponible(),
            // Les moyens que PayDunya sait deservir : les autres restent
            // proposes, mais a la main seulement.
            'moyens_automatiques' => array_keys((array) config('paiement.reversement.modes')),
            'en_cours'      => Reversement::where('statut', 'en_cours')->count(),
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
            // `manuel` constate un virement déjà fait ; `automatique` le fait
            // partir. Le second n'est offert que si PayDunya a ouvert l'option.
            'mode'      => 'sometimes|in:manuel,automatique',
            'reference' => 'nullable|string|max:120',
            'note'      => 'nullable|string|max:500',
        ]);

        $beneficiaire = User::findOrFail($donnees['user_id']);

        if ($beneficiaire->role !== 'proprietaire') {
            return response()->json(['message' => 'Seul un propriétaire perçoit un reversement.'], 422);
        }

        $automatique = ($donnees['mode'] ?? 'manuel') === 'automatique';

        if ($automatique && ($refus = $this->obstacleAuDeboursement($beneficiaire, $donnees['methode']))) {
            return response()->json(['message' => $refus], 422);
        }

        $resultat = DB::transaction(function () use ($donnees, $beneficiaire, $request, $automatique) {
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
                // Un déboursement n'est pas encore parti : il ne peut donc ni
                // être daté, ni se dire versé. Prétendre le contraire ferait
                // figurer comme payé ce que l'opérateur peut encore refuser.
                'statut'                 => $automatique ? 'en_cours' : 'manuel',
                'verse_le'               => $automatique ? null : now(),
                'reference'              => $donnees['reference'] ?? null,
                'note'                   => $donnees['note'] ?? null,
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

        $reversement = $resultat['reversement'];

        // Après la transaction, jamais dedans : un appel réseau de trente
        // secondes tiendrait ouverte une transaction posée sur des lignes
        // verrouillées, et bloquerait tout autre enregistrement pendant ce temps.
        if ($automatique) {
            $this->envoyer($reversement);
        }

        // Un versement manuel constate un virement déjà fait : il est acquis.
        // Un déboursement, lui, prévient depuis `inscrireLeStatut()`, quand et
        // seulement quand PayDunya confirme — ce qui peut venir bien plus tard.
        if (! $automatique) {
            $this->prevenirDuVersement($beneficiaire, $reversement);
        }

        return response()->json($reversement->fresh(), $reversement->statut === 'echoue' ? 502 : 201);
    }

    /* ══ Le déboursement lui-même ═════════════════════════════════ */

    /**
     * Ce qui empêche un déboursement automatique, en clair.
     *
     * Vérifié **avant** de rien créer : échouer après avoir verrouillé et
     * rattaché des paiements obligerait à tout défaire.
     */
    private function obstacleAuDeboursement(User $beneficiaire, string $methode): ?string
    {
        if (! $this->deboursement->disponible()) {
            return "Le déboursement automatique n'est pas actif. Faites le virement, "
                  ."puis enregistrez-le en versement manuel.";
        }

        if (! $this->deboursement->modeDeRetrait($methode)) {
            $nom = Reversement::METHODES[$methode] ?? $methode;

            return "PayDunya ne débourse pas vers « {$nom} » : ce moyen ne peut être "
                  ."employé qu'à la main.";
        }

        if (! $this->deboursement->numeroPourApi($beneficiaire->phone)) {
            return "Le numéro de {$beneficiaire->name} est absent ou incomplet : "
                  ."impossible de savoir où envoyer l'argent.";
        }

        return null;
    }

    /**
     * Envoie l'argent, puis inscrit ce que PayDunya en dit.
     *
     * L'échec rend les paiements à la file : sans cela, le propriétaire
     * attendrait un argent que plus rien ne réclame, et la somme disparaîtrait
     * des deux consoles à la fois.
     */
    private function envoyer(Reversement $reversement): void
    {
        $montant = (int) round((float) $reversement->montant);
        $minimum = (int) config('paiement.reversement.montant_minimum');

        if ($montant < $minimum) {
            $this->marquerEchoue(
                $reversement,
                "Montant inférieur au minimum de {$minimum} FCFA accepté par PayDunya."
            );

            return;
        }

        // La référence part avec la requête : PayDunya refuse de la rejouer,
        // ce qui interdit un second virement pour le même reversement.
        $reference = 'MV-REV-'.$reversement->id;

        $initiation = $this->deboursement->initier(
            $montant,
            (string) $this->deboursement->numeroPourApi($reversement->beneficiaire_telephone),
            (string) $this->deboursement->modeDeRetrait($reversement->methode),
            route('reversements.rappel'),
        );

        if (! $initiation['ok']) {
            $this->marquerEchoue($reversement, $initiation['message'] ?? 'Initiation refusée.', $initiation['brut']);

            return;
        }

        // Le jeton est enregistré **avant** la soumission. Si la requête
        // suivante se perd, c'est la seule chose qui permettra de retrouver la
        // transaction et de savoir si l'argent est parti.
        $reversement->update([
            'disburse_token' => $initiation['jeton'],
            'disburse_id'    => $reference,
        ]);

        $soumission = $this->deboursement->soumettre($initiation['jeton'], $reference);

        $this->inscrireLeStatut($reversement, $soumission['statut'], $soumission['message'], $soumission['brut']);
    }

    /**
     * Reporte un statut de déboursement sur le reversement.
     *
     * `cree` et `inconnu` restent « en cours » à dessein : ils veulent dire
     * qu'on ne sait pas, et un doute ne doit jamais rendre les paiements à la
     * file — ce serait risquer un second virement. Le suivi tranchera.
     */
    public function inscrireLeStatut(
        Reversement $reversement,
        ?string $statut,
        ?string $message,
        array $brut = [],
    ): void {
        $etaitDejaVerse = $reversement->statut === 'reussi';

        match ($statut) {
            'reussi' => $reversement->update([
                'statut'              => 'reussi',
                'verse_le'            => now(),
                'transaction_id'      => $brut['transaction_id'] ?? $reversement->transaction_id,
                'provider_ref'        => $brut['provider_ref'] ?? $reversement->provider_ref,
                'reponse_prestataire' => $brut,
                'echec_motif'         => null,
            ]),
            'echoue' => $this->marquerEchoue($reversement, $message ?? 'PayDunya a refusé le versement.', $brut),
            default  => $reversement->update([
                'statut'              => 'en_cours',
                'reponse_prestataire' => $brut ?: $reversement->reponse_prestataire,
            ]),
        };

        // PayDunya peut rappeler deux fois la même transaction, et le suivi
        // périodique repasse dessus : sans cette garde, le propriétaire serait
        // prévenu plusieurs fois d'un seul versement.
        if ($statut === 'reussi' && ! $etaitDejaVerse && $reversement->beneficiaire) {
            $this->prevenirDuVersement($reversement->beneficiaire, $reversement);
        }
    }

    /** L'échec rend les paiements à la file, et garde la trace de la tentative. */
    private function marquerEchoue(Reversement $reversement, string $motif, array $brut = []): void
    {
        DB::transaction(function () use ($reversement, $motif, $brut) {
            Paiement::where('reversement_id', $reversement->id)->update(['reversement_id' => null]);

            $reversement->update([
                'statut'              => 'echoue',
                'verse_le'            => null,
                'echec_motif'         => $motif,
                'reponse_prestataire' => $brut ?: $reversement->reponse_prestataire,
            ]);
        });
    }

    private function prevenirDuVersement(User $beneficiaire, Reversement $reversement): void
    {
        // Le propriétaire apprend qu'il a été payé sans avoir à surveiller son
        // téléphone : c'est le seul moment où l'argent change de mains.
        $this->push->versUtilisateur($beneficiaire, [
            'titre'  => 'Reversement effectué',
            'corps'  => number_format((float) $reversement->montant, 0, ',', ' ')
                        .' FCFA · '.(Reversement::METHODES[$reversement->methode] ?? ''),
            'url'    => '/dashboard/revenus',
            'groupe' => 'reversement',
        ]);
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
