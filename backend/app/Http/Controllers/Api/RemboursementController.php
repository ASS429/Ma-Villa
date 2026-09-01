<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JournalAdmin;
use App\Models\Paiement;
use App\Models\Remboursement;
use App\Models\Reservation;
use App\Services\Remboursement as CalculRemboursement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Rendre l'argent au client — l'enregistrement, pas le virement.
 *
 * Le virement de retour reste un geste humain chez le prestataire tant que
 * l'option de déboursement n'est pas ouverte. Ce contrôleur constate ce qui a
 * été fait, et c'est ce constat qui manquait : sans lui, le chiffre
 * d'affaires restait faux, aucune trace ne survivait, et un propriétaire déjà
 * payé gardait une somme que plus rien ne réclamait.
 */
class RemboursementController extends Controller
{
    /** Ce qui attend une décision, puis ce qui a été rendu. */
    public function index(): JsonResponse
    {
        $remboursements = Remboursement::with([
            'reservation:id,date_debut,date_fin,statut,user_id',
            'reservation.client:id,name,email',
            'paiement:id,montant,montant_proprietaire,methode,reference',
        ])->latest()->paginate(30);

        return response()->json($remboursements->toArray() + [
            'demandes'    => $this->demandes(),
            'total_rendu' => (float) Remboursement::sum('montant'),
            'a_recuperer' => (float) Remboursement::sum('a_recuperer_proprietaire'),
            'imputations' => Remboursement::IMPUTATIONS,
        ]);
    }

    /**
     * Les clients qui ont demandé l'annulation et attendent.
     *
     * Servi avec l'historique plutôt que sur une route séparée : les deux se
     * lisent sur le même écran, et deux requêtes pour une page qui s'ouvre
     * d'un clic depuis « Ce qui attend » n'apporteraient rien.
     *
     * @return array<int, array<string, mixed>>
     */
    private function demandes(): array
    {
        return Reservation::whereNotNull('annulation_demandee_le')
            ->where('statut', '!=', 'annulee')
            ->with([
                'client:id,name,email,phone',
                'paiement:id,reservation_id,montant,montant_proprietaire,methode,statut,reversement_id',
                'logement.villa:id,nom,ville',
            ])
            ->orderBy('annulation_demandee_le')
            ->get()
            ->map(fn (Reservation $r) => [
                'id'                     => $r->id,
                'date_debut'             => $r->date_debut?->toDateString(),
                'date_fin'               => $r->date_fin?->toDateString(),
                'demandee_le'            => $r->annulation_demandee_le?->toIso8601String(),
                'motif'                  => $r->annulation_motif,
                'client'                 => $r->client?->name,
                'contact'                => $r->client?->phone ?: $r->client?->email,
                'hebergement'            => $r->logement?->villa?->nom,
                'ville'                  => $r->logement?->villa?->ville,
                'montant'                => (float) ($r->paiement?->montant ?? 0),
                'part_proprietaire'      => (float) ($r->paiement?->montant_proprietaire ?? 0),
                'proprietaire_deja_paye' => $r->paiement?->reversement_id !== null,
            ])
            ->all();
    }

    /**
     * Ce qu'on propose de rendre, avant de rien faire.
     *
     * L'écran interroge cette route pendant que l'exploitant choisit la cause :
     * le montant change selon qui est responsable, et le voir changer aide à
     * comprendre la règle mieux qu'un texte d'aide.
     */
    public function proposition(Request $request, Reservation $reservation): JsonResponse
    {
        $donnees = $request->validate([
            'impute_a' => 'required|in:plateforme,proprietaire,client',
        ]);

        $paiement = $reservation->paiement;

        if (! $paiement || $paiement->statut !== 'reussi') {
            return response()->json([
                'message' => "Cette réservation n'a rien encaissé : il n'y a rien à rendre.",
            ], 422);
        }

        $calcul = CalculRemboursement::proposer($paiement, $donnees['impute_a']);

        return response()->json([
            'montant'            => $calcul->montant,
            'commission_rendue'  => $calcul->commissionRendue,
            'explication'        => $calcul->explication,
            'deja_rendu'         => (float) Remboursement::where('paiement_id', $paiement->id)->sum('montant'),
            'montant_encaisse'   => (float) $paiement->montant,
            'part_proprietaire'  => (float) $paiement->montant_proprietaire,
        ] + $this->etatDuVersement($paiement));
    }

    /**
     * Enregistre le remboursement.
     *
     * Le montant vient de la requête — contrairement aux reversements, où il
     * est sommé côté serveur. La différence est assumée : un reversement est
     * la somme de ce qui est dû, calculable ; un remboursement est une
     * décision, et le barème ne fait que la proposer. Il est **borné** par ce
     * qui a été encaissé, ce qui suffit à écarter l'écriture absurde.
     */
    public function store(Request $request, Reservation $reservation): JsonResponse
    {
        $donnees = $request->validate([
            'montant'   => 'required|numeric|min:0',
            'impute_a'  => 'required|in:plateforme,proprietaire,client',
            'motif'     => 'required|string|min:10|max:500',
            'reference' => 'sometimes|nullable|string|max:120',
            'commission_rendue' => 'sometimes|boolean',
        ]);

        $moi = $request->user();

        return DB::transaction(function () use ($request, $reservation, $donnees, $moi) {
            // Verrouillé comme un reversement : deux administrateurs qui
            // enregistrent en même temps rendraient deux fois.
            $paiement = Paiement::where('reservation_id', $reservation->id)
                ->lockForUpdate()
                ->first();

            if (! $paiement || $paiement->statut !== 'reussi') {
                return response()->json([
                    'message' => "Cette réservation n'a rien encaissé : il n'y a rien à rendre.",
                ], 422);
            }

            $dejaRendu = (float) Remboursement::where('paiement_id', $paiement->id)->sum('montant');
            $reste = (float) $paiement->montant - $dejaRendu;

            if ($donnees['montant'] > $reste + 0.001) {
                return response()->json([
                    'message' => 'On ne peut pas rendre plus que ce qui a été encaissé. '
                               . 'Reste remboursable : ' . number_format($reste, 0, ',', ' ') . ' FCFA.',
                ], 422);
            }

            $versement = $this->etatDuVersement($paiement);

            $remboursement = new Remboursement([
                'paiement_id'       => $paiement->id,
                'reservation_id'    => $reservation->id,
                'impute_a'          => $donnees['impute_a'],
                'commission_rendue' => (bool) ($donnees['commission_rendue'] ?? false),
                'motif'             => $donnees['motif'],
                'reference'         => $donnees['reference'] ?? null,
                'cree_par'          => $moi->id,
                // Recopié : la trace doit survivre à la suppression du compte.
                'createur_nom'      => $moi->name,
            ]);

            $remboursement->montant = $donnees['montant'];

            /*
             * Le propriétaire avait-il déjà été payé ?
             *
             * L'écran prévient mais laisse passer — refuser n'aiderait pas,
             * l'argent étant déjà sorti dans la réalité. Reste à savoir
             * combien récupérer, et c'est ce chiffre qui le dit.
             */
            $remboursement->a_recuperer_proprietaire = $versement['proprietaire_deja_paye']
                ? min((float) $paiement->montant_proprietaire, (float) $donnees['montant'])
                : 0;

            $remboursement->save();

            // Annuler la réservation coupe le versement à venir : sans cela,
            // la part du propriétaire resterait exigible sur un séjour rendu.
            if ($reservation->statut !== 'annulee') {
                $reservation->update([
                    'statut' => 'annulee',
                    'annulation_demandee_le' => null,
                ]);
            }

            JournalAdmin::consigner(
                $moi,
                'reservation.remboursee',
                $reservation,
                'Réservation n° ' . $reservation->id,
                [
                    'montant'   => $donnees['montant'],
                    'impute_a'  => $donnees['impute_a'],
                    'motif'     => $donnees['motif'],
                    'a_recuperer_proprietaire' => (float) $remboursement->a_recuperer_proprietaire,
                ],
                $request->ip(),
            );

            return response()->json(
                $remboursement->fresh()->toArray() + ['versement' => $versement],
                201
            );
        });
    }

    /**
     * Le propriétaire a-t-il déjà touché sa part sur ce paiement ?
     *
     * C'est la question qui décide si le remboursement coûte de l'argent à la
     * plateforme. `reversement_id` non nul veut dire que la somme est partie.
     *
     * @return array<string, mixed>
     */
    private function etatDuVersement(Paiement $paiement): array
    {
        $deja = $paiement->reversement_id !== null;

        return [
            'proprietaire_deja_paye' => $deja,
            'avertissement' => $deja
                ? 'Le propriétaire a déjà touché sa part sur cette réservation. Le remboursement '
                  . 'sera enregistré, mais la somme est sortie : il faudra la lui réclamer. '
                  . 'Le montant à récupérer est inscrit avec le remboursement.'
                : null,
        ];
    }
}
