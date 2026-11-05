<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Devis;
use App\Models\DevisRefuse;
use App\Models\JournalAdmin;
use App\Models\Logement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Services\DocumentPdf;
use App\Services\MontantEnLettres;
use App\Services\PrixSejour;
use App\Services\Push;
use App\Services\Telephone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;

/**
 * Les devis : établis en ligne par un client depuis une fiche, ou par l'équipe
 * dans la console, et téléchargés en PDF par un lien qui porte leur clé.
 *
 * En ligne, **aucun prix ne vient de la requête** : on lit le tarif, on compte
 * les nuits comme la réservation (`PrixSejour`), et l'on refuse ce qu'une
 * réservation refuserait — dates prises, séjour trop court, logement retiré. Un
 * devis est un engagement commercial : il ne doit pas promettre ce que la
 * réservation ne tiendrait pas.
 */
class DevisController extends Controller
{
    private const UNITES = [
        'nuitee'       => 'nuitée',
        'journee'      => 'journée',
        'demi_journee' => 'demi-journée',
        'pass'         => 'pass',
    ];

    private const FORMULES = [
        'nuitee'       => 'Nuitée',
        'journee'      => 'Journée',
        'demi_journee' => 'Demi-journée',
        'pass'         => 'Pass',
    ];

    /** Les mêmes mots, pour un devis en anglais (client venu de /en/). */
    private const UNITES_EN = ['nuitee' => 'night', 'journee' => 'day', 'demi_journee' => 'half-day', 'pass' => 'pass'];

    private const FORMULES_EN = ['nuitee' => 'Night', 'journee' => 'Day', 'demi_journee' => 'Half-day', 'pass' => 'Pass'];

    public function __construct(private Push $push) {}

    /* ── Le site ───────────────────────────────────────────────── */

    public function store(Request $request): JsonResponse
    {
        // Le champ piège : on répond comme si de rien n'était.
        if (filled($request->input('site_web'))) {
            return response()->json(['numero' => null, 'pdf' => null], 201);
        }

        if (is_string($request->input('telephone'))) {
            $request->merge(['telephone' => Telephone::nettoyer($request->input('telephone'))]);
        }

        $d = $request->validate([
            'logement_id'  => 'required|integer|exists:logements,id',
            'tarif_id'     => 'required|integer',
            'date_debut'   => 'required|date|after_or_equal:today|before:'.now()->addMonths(18)->toDateString(),
            'date_fin'     => 'required|date|after_or_equal:date_debut',
            'nb_personnes' => 'required|integer|min:1|max:200',
            'client_nom'   => 'required|string|max:160',
            'occupant_nom' => 'nullable|string|max:160',
            // Obligatoire depuis le 4 novembre 2026 : le devis tient lieu de
            // contact, et un devis sans numéro ne mène à personne.
            'telephone'    => ['required', 'string', 'max:30', 'regex:/^[^\p{L}]+$/u', Telephone::assezDeChiffres()],
            'email'        => 'nullable|email|max:160',
            'langue'       => 'sometimes|in:fr,en',
        ], [
            'date_debut.after_or_equal' => 'La date d’arrivée ne peut pas être passée.',
            'date_fin.after_or_equal'   => 'Le départ ne peut pas précéder l’arrivée.',
            'client_nom.required'       => 'Indiquez au nom de qui établir le devis.',
            'telephone.required'        => 'Indiquez un numéro pour que notre équipe vous réponde.',
            'telephone.regex'           => 'Écrivez le numéro en chiffres, sans lettres.',
        ]);

        $logement = Logement::with('villa')->findOrFail($d['logement_id']);
        $tarif = Tarif::where('logement_id', $logement->id)->find($d['tarif_id']);

        if (! $tarif) {
            return $this->refus('Cette formule n’appartient pas à ce logement.', 'tarif_id');
        }
        if (! $logement->disponible || $logement->villa?->statut !== 'validee') {
            DevisRefuse::noter($request, $logement, 'retire', $d);

            return response()->json(['message' => 'Ce logement n’est plus proposé.'], 409);
        }
        if ($d['nb_personnes'] > $logement->capacite) {
            DevisRefuse::noter($request, $logement, 'trop_de_monde', $d);

            return $this->refus("Ce logement accueille au maximum {$logement->capacite} personnes.", 'nb_personnes');
        }

        $prix = PrixSejour::pour($tarif, $d['date_debut'], $d['date_fin']);

        if ($prix['unites'] < 1) {
            return $this->refus('Choisissez une date de départ après l’arrivée.', 'date_fin');
        }
        if ($tarif->type_tarif === 'nuitee' && $prix['unites'] < $logement->nuits_minimum) {
            DevisRefuse::noter($request, $logement, 'trop_court', $d);

            return $this->refus("Ce logement se réserve pour {$logement->nuits_minimum} nuits au moins.", 'date_fin');
        }

        $pris = Reservation::where('logement_id', $logement->id)->bloquante()
            ->chevauchant($d['date_debut'], $d['date_fin'])->exists()
            || $logement->disponibilites()->where('disponible', false)
                ->where('date_debut', '<=', $d['date_fin'])
                ->where('date_fin', '>=', $d['date_debut'])->exists();
        if ($pris) {
            DevisRefuse::noter($request, $logement, 'dates_prises', $d);

            return response()->json([
                // Le site propose alors au client d'être rappelé : voir `DemandeParticuliereController::rappel`.
                'motif'   => 'dates_prises',
                'message' => 'Ce logement n’est pas disponible à ces dates.',
                'errors'  => ['date_debut' => ['Ce logement n’est pas disponible à ces dates.']],
            ], 409);
        }

        $villa = $logement->villa;
        $langue = $d['langue'] ?? 'fr';
        $devis = Devis::etablir('site', [
            'villa_id'         => $villa->id,
            'logement_id'      => $logement->id,
            'tarif_id'         => $tarif->id,
            'titre'            => $villa->nom,
            'client_nom'       => $d['client_nom'],
            'occupant_nom'     => $d['occupant_nom'] ?? null,
            'client_telephone' => $d['telephone'] ?? null,
            'client_email'     => $d['email'] ?? null,
            'date_arrivee'     => $d['date_debut'],
            'date_depart'      => $d['date_fin'],
            'personnes'        => $d['nb_personnes'],
            'valable_jusqu_au' => now()->addDays((int) config('devis.validite_jours', 7))->toDateString(),
            'conditions'       => config($langue === 'en' ? 'devis.conditions.site_en' : 'devis.conditions.site'),
            'cachet'           => false,
            'langue'           => $langue,
        ], [$this->ligneDuSejour($logement, $tarif, $prix, $langue)]);

        $this->prevenirLAdministration($devis);

        return response()->json([
            'numero'           => $devis->numero,
            'total'            => $devis->total,
            'valable_jusqu_au' => $devis->valable_jusqu_au?->toDateString(),
            'pdf'              => $devis->urlPdf(),
        ], 201);
    }

    /** Le PDF, pour qui a le lien. Une clé fausse répond comme un numéro inconnu. */
    public function pdf(Request $request, string $numero): Response
    {
        $devis = Devis::where('numero', $numero)->first();
        abort_unless($devis && hash_equals($devis->cle, (string) $request->query('cle', '')), 404);

        $disposition = $request->boolean('voir') ? 'inline' : 'attachment';

        return response(self::rendre($devis), 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => "{$disposition}; filename=\"".($devis->langue === 'en' ? 'Quote' : 'Devis')."-{$devis->numero}.pdf\"",
            'Cache-Control'       => 'private, no-store',
            'X-Robots-Tag'        => 'noindex, nofollow',
        ]);
    }

    public static function rendre(Devis $devis): string
    {
        return DocumentPdf::depuisVue('pdf.devis', self::donnees($devis));
    }

    /**
     * Ce que reçoit le gabarit, à part pour que les tests lisent le texte même du PDF.
     *
     * @return array<string, mixed>
     */
    public static function donnees(Devis $devis): array
    {
        $villa = $devis->villa;
        $en = $devis->langue === 'en';

        return [
            'devis'       => $devis,
            'en'          => $en,
            'emetteur'    => ($en ? ['activite' => 'Booking platform · Places to stay in Senegal'] : []) + config('devis.emetteur') + [
                'telephone' => (string) config('reservations.contact.telephone'),
                'email'     => (string) config('reservations.contact.email'),
            ],
            'logo'        => DocumentPdf::imageLocale('logo.png'),
            'cachetImage' => DocumentPdf::imageLocale('cachet.png'),
            'enLettres'   => $en ? MontantEnLettres::cfaFrancs((int) $devis->total) : MontantEnLettres::francsCfa((int) $devis->total),
            'sousTitre'   => $villa ? collect([$villa->quartier, $villa->ville])->filter()->unique()->implode(', ') : null,
            'duree'       => self::duree($devis),
        ];
    }

    /* ── La console ────────────────────────────────────────────── */

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'origine'   => 'sometimes|nullable|in:'.implode(',', Devis::ORIGINES),
            'recherche' => 'sometimes|nullable|string|max:100',
            'par_page'  => 'sometimes|integer|min:5|max:100',
        ]);

        $page = Devis::with('villa:id,nom,ville')
            ->when($request->filled('origine'), fn ($q) => $q->where('origine', $request->input('origine')))
            ->when($request->filled('recherche'), function ($q) use ($request) {
                $terme = '%'.$request->input('recherche').'%';
                $q->where(fn ($s) => $s->where('numero', 'like', $terme)
                    ->orWhere('client_nom', 'like', $terme)
                    ->orWhere('titre', 'like', $terme));
            })
            ->latest()
            ->latest('id')
            ->paginate($request->integer('par_page', 20));

        $page->getCollection()->transform(fn (Devis $d) => $this->pourLaConsole($d));

        return response()->json($page);
    }

    public function show(Devis $devis): JsonResponse
    {
        return response()->json($this->pourLaConsole($devis->load('villa:id,nom,ville')));
    }

    public function storeAdmin(Request $request): JsonResponse
    {
        $d = $this->valider($request, true);

        $devis = Devis::etablir('console', $this->attributs($d) + [
            'conditions' => $d['conditions']
                ?? config(($d['langue'] ?? 'fr') === 'en' ? 'devis.conditions.console_en' : 'devis.conditions.console'),
        ], $d['lignes'], $request->user());

        JournalAdmin::consigner($request->user(), 'devis.etabli', $devis, $devis->numero, [
            'client' => $devis->client_nom,
            'total'  => $devis->total,
        ], $request->ip());

        return response()->json($this->pourLaConsole($devis->load('villa:id,nom,ville')), 201);
    }

    public function update(Request $request, Devis $devis): JsonResponse
    {
        $d = $this->valider($request, false);

        $devis->fill($this->attributs($d, $devis));
        if (array_key_exists('conditions', $d)) {
            $devis->conditions = $d['conditions'];
        }
        if (isset($d['lignes'])) {
            $devis->remplacerLignes($d['lignes']);
        }
        if (isset($d['statut'])) {
            $devis->statut = $d['statut'];
        }
        if ($request->boolean('suivi') && ! $devis->suivi_le) {
            $devis->suivi_le = now();
        }
        $devis->save();

        JournalAdmin::consigner($request->user(), 'devis.modifie', $devis, $devis->numero, [
            'statut' => $devis->statut,
            'total'  => $devis->total,
        ], $request->ip());

        return response()->json($this->pourLaConsole($devis->load('villa:id,nom,ville')));
    }

    /**
     * Supprimer un devis, à la demande d'un client ou pour retirer une erreur.
     *
     * Un devis accepté est une pièce commerciale, annoncée comme gardée dix ans :
     * il faut d'abord dire qu'il ne l'était pas. Le journal garde le numéro, jamais
     * le client : effacer quelqu'un partout sauf dans le journal ne l'effacerait pas.
     */
    public function destroy(Request $request, Devis $devis): JsonResponse
    {
        if ($devis->statut === 'accepte') {
            return response()->json([
                'message' => 'Ce devis est accepté : c’est une pièce commerciale, gardée dix ans. S’il a été accepté par erreur, changez d’abord son statut.',
            ], 422);
        }

        $numero = $devis->numero;
        $origine = $devis->origine;
        $total = $devis->total;

        $devis->effacer();

        JournalAdmin::where('cible_type', 'Devis')->where('cible_id', $devis->id)->get()
            ->each(function (JournalAdmin $ligne) {
                $details = $ligne->details ?? [];
                unset($details['client']);
                $ligne->details = $details ?: null;
                $ligne->save();
            });

        JournalAdmin::consigner($request->user(), 'devis.supprime', $devis, $numero, [
            'origine' => $origine,
            'total'   => $total,
        ], $request->ip());

        return response()->json(['message' => "Devis {$numero} supprimé."]);
    }

    /* ── Outils ────────────────────────────────────────────────── */

    /** @return array<string, mixed> */
    private function valider(Request $request, bool $creation): array
    {
        $requis = $creation ? 'required' : 'sometimes';

        if (is_string($request->input('client_telephone'))) {
            $request->merge(['client_telephone' => Telephone::nettoyer($request->input('client_telephone'))]);
        }

        return $request->validate([
            'titre'                  => "{$requis}|string|max:160",
            'client_nom'             => "{$requis}|string|max:160",
            'occupant_nom'           => 'nullable|string|max:160',
            'client_telephone'       => ['nullable', 'string', 'max:30', 'regex:/^[^\p{L}]+$/u'],
            'client_email'           => 'nullable|email|max:160',
            'villa_id'               => 'nullable|integer|exists:villas,id',
            'logement_id'            => 'nullable|integer|exists:logements,id',
            'tarif_id'               => 'nullable|integer|exists:tarifs,id',
            'date_arrivee'           => 'nullable|date',
            'date_depart'            => 'nullable|date|after_or_equal:date_arrivee',
            'personnes'              => 'nullable|integer|min:1|max:1000',
            'validite_jours'         => 'nullable|integer|min:1|max:365',
            'conditions'             => 'nullable|string|max:2000',
            'cachet'                 => 'sometimes|boolean',
            'statut'                 => 'sometimes|in:'.implode(',', array_keys(Devis::STATUTS)),
            'langue'                 => 'sometimes|in:fr,en',
            'lignes'               => "{$requis}|array|min:1|max:30",
            'lignes.*.designation'   => 'required_with:lignes|string|max:200',
            'lignes.*.detail'        => 'nullable|string|max:300',
            'lignes.*.quantite'      => 'required_with:lignes|integer|min:1|max:10000',
            'lignes.*.unite'         => 'nullable|string|max:30',
            'lignes.*.prix_unitaire' => 'required_with:lignes|integer|min:0|max:1000000000',
        ], [
            'lignes.required'                    => 'Ajoutez au moins une prestation.',
            'lignes.*.designation.required_with' => 'Chaque prestation a besoin d’un intitulé.',
            'date_depart.after_or_equal'         => 'Le départ ne peut pas précéder l’arrivée.',
        ]);
    }

    /**
     * @param  array<string, mixed>  $d
     * @return array<string, mixed>
     */
    private function attributs(array $d, ?Devis $existant = null): array
    {
        $champs = array_intersect_key($d, array_flip([
            'titre', 'client_nom', 'occupant_nom', 'client_telephone', 'client_email',
            'villa_id', 'logement_id', 'tarif_id', 'date_arrivee', 'date_depart', 'personnes', 'cachet', 'langue',
        ]));

        if (array_key_exists('validite_jours', $d) || ! $existant) {
            $jours = (int) ($d['validite_jours'] ?? config('devis.validite_jours', 7));
            $depart = $existant?->date_emission ?? now();
            $champs['valable_jusqu_au'] = Carbon::parse($depart)->addDays($jours)->toDateString();
        }

        return $champs;
    }

    /** @return array<string, mixed> */
    private function pourLaConsole(Devis $devis): array
    {
        return $devis->toArray() + [
            'pdf'            => $devis->urlPdf(),
            'libelle_statut' => Devis::STATUTS[$devis->statut] ?? $devis->statut,
        ];
    }

    /**
     * @param  array{unites: int, montant: int, sans_reduction: int, prix_applique: string}  $prix
     * @return array<string, mixed>
     */
    private function ligneDuSejour(Logement $logement, Tarif $tarif, array $prix, string $langue = 'fr'): array
    {
        $en = $langue === 'en';
        $options = collect([
            $tarif->avec_clim ? ($en ? 'with air conditioning' : 'avec clim') : null,
            $tarif->avec_buffet ? ($en ? 'with buffet' : 'avec buffet') : null,
        ])->filter()->implode($en ? ' and ' : ' et ');
        $formule = (($en ? self::FORMULES_EN : self::FORMULES)[$tarif->type_tarif] ?? $tarif->type_tarif)
            .($options ? ", {$options}" : '');
        $unite = ($en ? self::UNITES_EN : self::UNITES)[$tarif->type_tarif] ?? null;
        $designation = ($en ? 'Rental' : 'Location')." · {$logement->nom}";

        // Prix de la semaine ou du mois : le total n'est plus « prix × nuits ».
        // Une seule ligne, au montant réel, qui dit ce qui a été appliqué.
        if ($prix['prix_applique'] !== 'unite') {
            $semaine = $prix['prix_applique'] === 'semaine';
            $sans = number_format($prix['sans_reduction'], 0, ',', "\u{00A0}");
            $detail = $en
                ? "{$formule} · {$prix['unites']} {$unite}s at the ".($semaine ? 'weekly' : 'monthly')." price (instead of {$sans} FCFA)"
                : "{$formule} · {$prix['unites']} {$unite}s au prix ".($semaine ? 'de la semaine' : 'du mois')." (au lieu de {$sans} FCFA)";

            return [
                'designation'   => $designation,
                'detail'        => $detail,
                'quantite'      => 1,
                'unite'         => $en ? 'stay' : 'séjour',
                'prix_unitaire' => $prix['montant'],
            ];
        }

        return [
            'designation'   => $designation,
            'detail'        => $formule,
            'quantite'      => $prix['unites'],
            'unite'         => $unite,
            'prix_unitaire' => (int) $tarif->prix,
        ];
    }

    /** « 2 nuitées », « 3 jours » : ce que dure le séjour, si les dates le disent. */
    private static function duree(Devis $devis): ?string
    {
        if (! $devis->date_arrivee || ! $devis->date_depart) {
            return null;
        }

        $type = $devis->tarif_id ? Tarif::whereKey($devis->tarif_id)->value('type_tarif') : 'nuitee';
        $n = PrixSejour::unites($type ?? 'nuitee', $devis->date_arrivee->toDateString(), $devis->date_depart->toDateString());

        if ($n < 1) {
            return null;
        }

        if ($devis->langue === 'en') {
            return ($type ?? 'nuitee') === 'nuitee' ? $n.' night'.($n > 1 ? 's' : '') : $n.' day'.($n > 1 ? 's' : '');
        }

        return ($type ?? 'nuitee') === 'nuitee'
            ? $n.' nuitée'.($n > 1 ? 's' : '')
            : $n.' jour'.($n > 1 ? 's' : '');
    }

    private function refus(string $message, string $champ): JsonResponse
    {
        return response()->json(['message' => $message, 'errors' => [$champ => [$message]]], 422);
    }

    private function prevenirLAdministration(Devis $devis): void
    {
        $total = number_format($devis->total, 0, ',', "\u{00A0}");

        foreach (User::where('role', 'admin')->get() as $admin) {
            $this->push->versUtilisateur($admin, [
                'titre'  => "Devis demandé en ligne — {$devis->numero}",
                'corps'  => "{$devis->client_nom} · {$devis->titre} · {$total} FCFA",
                'url'    => '/admin/devis',
                'groupe' => "devis-{$devis->id}",
            ]);
        }
    }
}
