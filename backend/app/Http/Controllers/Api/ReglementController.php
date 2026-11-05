<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Devis;
use App\Models\JournalAdmin;
use App\Models\Paiement;
use App\Models\Reglement;
use App\Services\DocumentPdf;
use App\Services\Encaissement;
use App\Services\MontantEnLettres;
use App\Services\Tableur;
use App\Services\Telephone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;

/**
 * Enregistrer l'argent reçu hors du site, et en donner reçu. Voir `Encaissement`.
 *
 * Rien ne part d'ici et rien n'est débité : on constate une somme réellement reçue.
 */
class ReglementController extends Controller
{
    /** Le registre : ce qui est entré, par quel moyen, et ce qui reste à recevoir. */
    public function index(Request $request): JsonResponse
    {
        $d = $request->validate([
            'moyen'     => 'sometimes|nullable|in:'.implode(',', array_keys(Reglement::MOYENS)),
            'recherche' => 'sometimes|nullable|string|max:100',
            'par_page'  => 'sometimes|integer|min:5|max:100',
        ]);

        $page = $this->requete($d)->paginate($request->integer('par_page', 25));

        return response()->json($page->toArray() + [
            'totaux' => Reglement::valide()->selectRaw('moyen, SUM(montant) as total, COUNT(*) as nombre')
                ->groupBy('moyen')->orderByDesc('total')->get()
                ->map(fn ($l) => [
                    'moyen'   => $l->moyen,
                    'libelle' => Reglement::MOYENS[$l->moyen] ?? $l->moyen,
                    'total'   => (int) $l->total,
                    'nombre'  => (int) $l->nombre,
                ]),
            'soldes' => $this->soldes(),
            'moyens' => Reglement::MOYENS,
        ]);
    }

    /** Une pièce de caisse qui sort de la plateforme : le téléchargement est noté au journal. */
    public function export(Request $request): Response
    {
        $d = $request->validate([
            'moyen'     => 'sometimes|nullable|in:'.implode(',', array_keys(Reglement::MOYENS)),
            'recherche' => 'sometimes|nullable|string|max:100',
        ]);

        $lignes = $this->requete($d)->get();

        $csv = Tableur::csv(
            ['Reçu', 'Reçu le', 'Client', 'Devis', 'Moyen', 'Référence', 'Montant (FCFA)', 'Statut', 'Enregistré par', 'Note', 'Motif d’annulation'],
            $lignes->map(fn (Reglement $r) => [
                $r->numero,
                $r->recu_le?->format('d/m/Y'),
                $r->client_nom,
                $r->devis_numero,
                $r->libelle_moyen,
                $r->reference,
                $r->montant,
                $r->statut === 'valide' ? 'Valide' : 'Annulé',
                $r->createur_nom,
                $r->note,
                $r->annule_motif,
            ]),
        );

        JournalAdmin::consigner($request->user(), 'reglements.exporte', null, 'Registre des règlements', [
            'lignes' => $lignes->count(),
        ], $request->ip());

        return response($csv, 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="PasseTemps-reglements-'.now()->format('Y-m-d').'.csv"',
            'Cache-Control'       => 'private, no-store',
        ]);
    }

    /** Ce que l'écran d'un devis doit savoir. */
    public function pourDevis(Devis $devis): JsonResponse
    {
        return response()->json(Encaissement::etat($devis));
    }

    public function store(Request $request, Devis $devis): JsonResponse
    {
        if (is_string($request->input('payeur_telephone'))) {
            $request->merge(['payeur_telephone' => Telephone::nettoyer($request->input('payeur_telephone'))]);
        }

        $d = $request->validate([
            'montant'          => 'required|integer|min:1|max:99999999',
            'moyen'            => 'required|in:'.implode(',', array_keys(Reglement::MOYENS)),
            'recu_le'          => 'required|date|before_or_equal:today|after:'.now()->subYears(2)->toDateString(),
            'reference'        => 'nullable|string|max:120',
            'payeur_telephone' => ['nullable', 'string', 'max:30', 'regex:/^[^\p{L}]+$/u'],
            'note'             => 'nullable|string|max:500',
            'confirmer'        => 'sometimes|boolean',
        ], [
            'montant.required'       => 'Indiquez la somme reçue.',
            'montant.min'            => 'Indiquez la somme reçue.',
            'recu_le.before_or_equal' => 'On n’enregistre pas une somme qui n’a pas encore été reçue.',
            'recu_le.after'          => 'Cette date a plus de deux ans : vérifiez-la.',
            'payeur_telephone.regex' => 'Écrivez le numéro en chiffres, sans lettres.',
        ]);

        $reglement = Encaissement::enregistrer($devis, $d, $request->user());

        JournalAdmin::consigner($request->user(), 'reglement.enregistre', $reglement, $reglement->numero, [
            'devis'   => $reglement->devis_numero,
            'montant' => $reglement->montant,
            'moyen'   => $reglement->moyen,
        ], $request->ip());

        return response()->json($reglement, 201);
    }

    public function annuler(Request $request, Reglement $reglement): JsonResponse
    {
        $d = $request->validate(['motif' => 'required|string|min:10|max:500'], [
            'motif.required' => 'Dites pourquoi ce règlement est annulé.',
            'motif.min'      => 'Dites pourquoi ce règlement est annulé, en quelques mots.',
        ]);

        Encaissement::annuler($reglement, $d['motif'], $request->user());

        JournalAdmin::consigner($request->user(), 'reglement.annule', $reglement, $reglement->numero, [
            'montant' => $reglement->montant,
            'motif'   => $d['motif'],
        ], $request->ip());

        return response()->json($reglement->fresh());
    }

    public function clore(Request $request, Devis $devis): JsonResponse
    {
        $d = $request->validate(['motif' => 'required|string|min:10|max:500'], [
            'motif.required' => 'Dites pourquoi le reste ne sera pas payé.',
            'motif.min'      => 'Dites pourquoi le reste ne sera pas payé, en quelques mots.',
        ]);

        $recu = Encaissement::clore($devis, $request->user());

        JournalAdmin::consigner($request->user(), 'devis.solde_clos', $devis, $devis->numero, [
            'recu'  => $recu,
            'total' => $devis->total,
            'motif' => $d['motif'],
        ], $request->ip());

        return response()->json(Encaissement::etat($devis->fresh()));
    }

    public function annulation(Request $request, Devis $devis): JsonResponse
    {
        $d = $request->validate(['motif' => 'required|string|min:10|max:500'], [
            'motif.required' => 'Dites ce que le client a demandé.',
            'motif.min'      => 'Dites ce que le client a demandé, en quelques mots.',
        ]);

        Encaissement::signalerUneAnnulation($devis, $d['motif']);

        JournalAdmin::consigner($request->user(), 'devis.annulation_signalee', $devis, $devis->numero, [
            'motif' => $d['motif'],
        ], $request->ip());

        return response()->json(Encaissement::etat($devis->fresh()));
    }

    /** Le reçu, pour qui a le lien. Une clé fausse répond comme un numéro inconnu. */
    public function pdf(Request $request, string $numero): Response
    {
        $reglement = Reglement::where('numero', $numero)->first();
        abort_unless($reglement && hash_equals($reglement->cle, (string) $request->query('cle', '')), 404);

        $disposition = $request->boolean('voir') ? 'inline' : 'attachment';
        $nom = ($reglement->langue === 'en' ? 'Receipt' : 'Recu')."-{$reglement->numero}.pdf";

        return response(self::rendre($reglement), 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => "{$disposition}; filename=\"{$nom}\"",
            'Cache-Control'       => 'private, no-store',
            'X-Robots-Tag'        => 'noindex, nofollow',
        ]);
    }

    public static function rendre(Reglement $reglement): string
    {
        return DocumentPdf::depuisVue('pdf.recu', self::donnees($reglement));
    }

    /**
     * Ce que reçoit le gabarit. Le reçu dit l'état du dossier **à ce règlement-là**, pas
     * aujourd'hui : relu plus tard, il doit dire la même chose.
     *
     * @return array<string, mixed>
     */
    public static function donnees(Reglement $reglement): array
    {
        $en = $reglement->langue === 'en';
        $devis = $reglement->devis_id ? Devis::withTrashed()->with('villa')->find($reglement->devis_id) : null;
        $total = (int) ($devis?->total ?? $reglement->montant);

        $avant = (int) Reglement::where('devis_id', $reglement->devis_id)->valide()
            ->whereKeyNot($reglement->id)
            ->where(fn ($q) => $q->whereDate('recu_le', '<', $reglement->recu_le)
                ->orWhere(fn ($m) => $m->whereDate('recu_le', $reglement->recu_le)->where('id', '<', $reglement->id)))
            ->sum('montant');

        return [
            'reglement' => $reglement,
            'devis'     => $devis,
            'en'        => $en,
            'emetteur'  => DevisController::emetteur($en),
            'logo'      => DocumentPdf::imageLocale('logo.png'),
            'total'     => $total,
            'avant'     => $avant,
            'reste'     => max(0, $total - $avant - $reglement->montant),
            'enLettres' => $en ? MontantEnLettres::cfaFrancs($reglement->montant) : MontantEnLettres::francsCfa($reglement->montant),
            'moyen'     => ($en ? Reglement::MOYENS_EN : Reglement::MOYENS)[$reglement->moyen] ?? $reglement->moyen,
            'lieu'      => $devis?->villa ? collect([$devis->villa->quartier, $devis->villa->ville])->filter()->unique()->implode(', ') : null,
        ];
    }

    private function requete(array $d)
    {
        return Reglement::query()
            ->when($d['moyen'] ?? null, fn ($q, $m) => $q->where('moyen', $m))
            ->when($d['recherche'] ?? null, function ($q, $r) {
                $terme = '%'.$r.'%';
                $q->where(fn ($s) => $s->where('numero', 'like', $terme)
                    ->orWhere('client_nom', 'like', $terme)
                    ->orWhere('devis_numero', 'like', $terme)
                    ->orWhere('reference', 'like', $terme));
            })
            ->orderByDesc('recu_le')
            ->orderByDesc('id');
    }

    /**
     * Les dossiers où il reste de l'argent à recevoir, les plus proches de l'arrivée d'abord.
     *
     * @return array<int, array<string, mixed>>
     */
    private function soldes(): array
    {
        return Paiement::query()->abouti()->where('hors_ligne', true)->where('solde', '>', 0)
            ->whereHas('reservation', fn ($q) => $q->where('statut', '!=', 'annulee'))
            ->with('reservation.logement.villa:id,nom', 'reservation.devis:id,reservation_id,numero,client_nom,client_telephone')
            ->get()
            ->sortBy(fn (Paiement $p) => $p->reservation->date_debut)
            ->values()
            ->map(fn (Paiement $p) => [
                'devis_id'    => $p->reservation->devis?->id,
                'devis'       => $p->reservation->devis?->numero,
                'client'      => $p->reservation->devis?->client_nom,
                'telephone'   => $p->reservation->devis?->client_telephone,
                'hebergement' => $p->reservation->logement?->villa?->nom,
                'date_debut'  => Carbon::parse($p->reservation->date_debut)->toDateString(),
                'date_fin'    => Carbon::parse($p->reservation->date_fin)->toDateString(),
                'encaisse'    => (int) round((float) $p->montant),
                'solde'       => (int) round((float) $p->solde),
            ])
            ->all();
    }
}
