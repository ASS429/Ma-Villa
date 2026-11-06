<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DemandeService;
use App\Models\JournalAdmin;
use App\Models\Reglement;
use App\Models\User;
use App\Services\Prestations;
use App\Services\Push;
use App\Services\Telephone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Les services aux voyageurs : transport et repas.
 *
 * Une demande, pas une réservation : le visiteur dit ce dont il a besoin, la
 * demande est gardée ici, et la réponse se fait sur WhatsApp. Rien n'est payé
 * en ligne : le client règle PasseTemps une fois le service confirmé, l'équipe
 * l'enregistre dans la console, puis y note le reversement au prestataire.
 *
 * Chaque famille s'ouvre par sa variable ; fermée, elle n'existe que pour
 * l'administration, en aperçu (`App\Services\Prestations`).
 */
class DemandeServiceController extends Controller
{
    public function __construct(private Push $push) {}

    /**
     * Le catalogue des familles ouvertes, dans les deux langues.
     *
     * À part de `/configuration`, que chaque visiteur charge sur chaque page :
     * il ne sert qu'aux pages des services, et la data mobile se paie.
     *
     * Tout fermé, la porte répond 404 — pas 503 : un 503 dirait « ça existe,
     * revenez plus tard » et inviterait les moteurs à garder l'adresse. Même
     * choix que la boutique.
     */
    public function catalogue(): JsonResponse
    {
        $familles = Prestations::famillesVisibles();
        abort_if($familles === [], 404);

        // Des champs nommés, jamais la configuration telle quelle : elle porte la part du
        // prestataire et son nom, qui n'ont rien à faire chez le client.
        $catalogue = collect(config('prestations.catalogue'))
            ->filter(fn (array $p) => in_array($p['famille'], $familles, true))
            ->map(fn (array $p, string $cle) => ['cle' => $cle] + array_intersect_key($p, array_flip([
                'famille', 'prix_a_partir_de', 'vol', 'libelle', 'unite', 'description', 'vehicule',
            ])))
            ->values();

        $vehicules = collect(config('prestations.vehicules', []))
            ->only($catalogue->pluck('vehicule')->filter()->unique()->values()->all())
            ->map(fn (array $v) => array_intersect_key($v, array_flip([
                'nom', 'photos', 'atouts', 'horaires', 'reservation', 'annulation', 'reglement',
            ])));

        $ouvertes = Prestations::famillesOuvertes();

        return response()->json([
            'familles' => collect($familles)
                ->mapWithKeys(fn (string $f) => [$f => config("prestations.familles.{$f}.libelle")]),
            'catalogue' => $catalogue,
            'vehicules' => $vehicules->isEmpty() ? new \stdClass : $vehicules,
            'delai_reponse_heures' => (int) config('prestations.delai_reponse_heures'),
            // Les familles que l'administration voit sans que le public les
            // voie : l'écran le dit, pour qu'on ne prenne pas un aperçu pour
            // une ouverture.
            'en_apercu' => array_values(array_diff($familles, $ouvertes)),
        ]);
    }

    /**
     * Enregistrer une demande.
     *
     * Publique : une famille qui arrive de l'étranger ne se crée pas un compte
     * pour demander un chauffeur. La porte ouverte se paie en robots, d'où le
     * débit limité et le champ piège.
     */
    public function store(Request $request): JsonResponse
    {
        /*
        | Le champ piège. Invisible pour un humain, rempli par les robots qui
        | complètent tout ce qu'ils trouvent. On répond comme si de rien
        | n'était : un refus leur apprendrait à l'éviter.
        */
        if (filled($request->input('site_web'))) {
            return response()->json(['id' => null, 'reference' => null], 201);
        }

        // Rien d'ouvert : la porte n'existe pas, comme le catalogue.
        $demandables = Prestations::clesDemandables();
        abort_if($demandables === [], 404);

        // Un numéro collé depuis WhatsApp porte des marques invisibles et des
        // espaces insécables : refusé jusqu'au 1er novembre 2026 avec « que
        // des chiffres », alors qu'il n'y avait à l'écran que des chiffres.
        if (is_string($request->input('telephone'))) {
            $request->merge(['telephone' => Telephone::nettoyer($request->input('telephone'))]);
        }

        $donnees = $request->validate([
            // Une prestation d'une famille fermée est refusée comme une
            // prestation inconnue : pour le public, elle n'existe pas.
            'prestation'   => 'required|string|in:'.implode(',', $demandables),
            'date_service' => 'required|date|after_or_equal:today|before:'.now()->addYear()->toDateString(),
            'heure'        => 'nullable|date_format:H:i',
            'personnes'    => 'required|integer|min:1|max:50',
            'lieu'         => 'required|string|max:160',
            // La position, si le visiteur l'a donnée : les deux ou aucune.
            'latitude'     => 'nullable|required_with:longitude|numeric|between:-90,90',
            'longitude'    => 'nullable|required_with:latitude|numeric|between:-180,180',
            'precision_m'  => 'nullable|integer|min:0|max:100000',
            'vol'          => 'nullable|string|max:20',
            'delegation'   => 'nullable|string|max:80',
            'nom'          => 'required|string|max:80',
            // Seules les lettres sont refusées : « appelez-moi » n'est pas un
            // numéro, mais « +221 78 123 45 67 », « 00221 70… » ou
            // « 33 820 12 34 » en sont, quelle que soit la ponctuation.
            'telephone'    => ['required', 'string', 'max:30', 'regex:/^[^\p{L}]+$/u', function ($attribut, $valeur, $echec) {
                // Huit chiffres au moins : en deçà, ce n'est un numéro nulle part,
                // et on ne pourrait pas rappeler la famille.
                if (strlen(Telephone::chiffres((string) $valeur)) < 8) {
                    $echec('Ce numéro de téléphone est trop court.');
                }
            }],
            'email'        => 'nullable|email|max:120',
            'message'      => 'nullable|string|max:1000',
            'langue'       => 'sometimes|in:fr,en',
            'origine'      => 'sometimes|nullable|in:'.implode(',', DemandeService::ORIGINES),
        ], [
            'prestation.in'               => 'Ce service n’est pas proposé.',
            'date_service.after_or_equal' => 'La date ne peut pas être passée.',
            'telephone.regex'             => 'Écrivez le numéro en chiffres, sans lettres.',
        ]);

        if ($refus = $this->refusDHoraire($donnees)) {
            return $refus;
        }

        $demande = DemandeService::create($donnees + [
            'user_id' => auth('sanctum')->id(),
            'langue'  => $donnees['langue'] ?? 'fr',
        ]);

        $this->prevenirLAdministration($demande);

        return response()->json([
            'id'        => $demande->id,
            'reference' => $demande->reference,
        ], 201);
    }

    /**
     * Un véhicule a ses heures et son délai. Une demande hors de ses heures, ou trop
     * tardive pour qu'on trouve le chauffeur, se refuse ici plutôt qu'au téléphone.
     * Sans heure, on ne peut rien juger : l'équipe la fixe avec le client.
     *
     * @param  array<string, mixed>  $d
     */
    private function refusDHoraire(array $d): ?JsonResponse
    {
        $cle = config("prestations.catalogue.{$d['prestation']}.vehicule");
        $vehicule = $cle ? config("prestations.vehicules.{$cle}") : null;

        if (! $vehicule || empty($d['heure'])) {
            return null;
        }

        $langue = ($d['langue'] ?? 'fr') === 'en' ? 'en' : 'fr';

        if ($d['heure'] < $vehicule['heure_debut'] || $d['heure'] > $vehicule['heure_fin']) {
            return response()->json([
                'message' => $langue === 'en' ? 'This car runs from 6 am to midnight.' : 'Ce véhicule roule de 6 h à minuit.',
                'errors'  => ['heure' => [$langue === 'en' ? 'Choose a time between 6 am and midnight.' : 'Choisissez une heure entre 6 h et minuit.']],
            ], 422);
        }

        $depart = Carbon::parse($d['date_service'].' '.$d['heure']);
        if ($depart->lt(now()->addHours((int) $vehicule['delai_min_heures']))) {
            $texte = $langue === 'en'
                ? 'This ride must be booked at least 2 hours ahead, ideally the day before.'
                : 'Ce trajet se réserve au moins 2 h à l’avance, idéalement la veille.';

            return response()->json(['message' => $texte, 'errors' => ['heure' => [$texte]]], 422);
        }

        return null;
    }

    public function indexAdmin(Request $request): JsonResponse
    {
        $request->validate([
            'statut'   => 'sometimes|nullable|in:'.implode(',', array_keys(DemandeService::STATUTS)),
            // « À reverser » : payées par le client, la part du prestataire pas encore versée.
            'argent'   => 'sometimes|nullable|in:a_reverser',
            'par_page' => 'sometimes|integer|min:5|max:100',
        ]);

        return response()->json(
            DemandeService::query()
                ->with('traiteePar:id,name')
                ->when($request->filled('statut'), fn ($q) => $q->where('statut', $request->input('statut')))
                ->when($request->input('argent') === 'a_reverser', fn ($q) => $q->aReverser())
                // La plus proche du service d'abord : c'est l'urgence réelle,
                // pas l'ordre d'arrivée.
                ->orderByRaw("case when statut = 'nouvelle' then 0 else 1 end")
                ->orderBy('date_service')
                ->latest('id')
                ->paginate($request->integer('par_page', 20))
        );
    }

    /**
     * Marquer une demande traitée — ou abandonnée, ou la rouvrir.
     *
     * Ce n'est pas un échange avec le client, qui a lieu sur WhatsApp : c'est
     * la trace qu'on lui a répondu, et la seule chose qui la fait sortir de la
     * file d'attente.
     */
    public function traiter(Request $request, DemandeService $demande): JsonResponse
    {
        $donnees = $request->validate([
            'statut' => 'required|in:'.implode(',', array_keys(DemandeService::STATUTS)),
        ]);

        $avant = $demande->statut;

        $demande->statut = $donnees['statut'];
        $demande->traitee_le = $donnees['statut'] === 'nouvelle' ? null : now();
        $demande->traitee_par = $donnees['statut'] === 'nouvelle' ? null : $request->user()->id;
        $demande->save();

        JournalAdmin::consigner(
            $request->user(),
            'demande_service.statut',
            $demande,
            "{$demande->reference} — {$demande->libelle_prestation}",
            ['statut_avant' => $avant, 'statut_apres' => $demande->statut],
            $request->ip(),
        );

        return response()->json($demande->fresh()->load('traiteePar:id,name'));
    }

    /* ══ L'argent du service ══════════════════════════════════════ */

    /**
     * Le client a payé PasseTemps : on le constate, rien ne part d'ici.
     *
     * La part du prestataire est figée maintenant, parce que le prix confirmé au client
     * peut différer du prix affiché (une autre ville, 35 000 F au minimum). Par défaut,
     * la somme reçue moins notre commission habituelle sur cette prestation.
     */
    public function encaisser(Request $request, DemandeService $demande): JsonResponse
    {
        $d = $request->validate([
            'montant'          => 'required|integer|min:1000|max:10000000',
            'part_prestataire' => 'nullable|integer|min:0|lte:montant',
            'prestataire'      => 'nullable|string|max:80',
            'moyen'            => 'required|in:'.implode(',', array_keys(Reglement::MOYENS)),
            'recu_le'          => 'required|date|before_or_equal:today',
            'reference'        => 'nullable|string|max:80',
        ], [
            'part_prestataire.lte' => 'La part du prestataire ne peut pas dépasser la somme reçue.',
        ]);

        $repartition = $demande->repartition;
        $prestataire = trim((string) ($d['prestataire'] ?? '')) ?: ($repartition['prestataire'] ?? '');
        $part = $d['part_prestataire'] ?? ($repartition ? max(0, $d['montant'] - $repartition['commission']) : null);

        if ($part === null || $prestataire === '') {
            return response()->json([
                'message' => 'Cette prestation n’a pas de prestataire attitré : dites qui l’assure et ce qui lui revient.',
                'errors'  => ['part_prestataire' => ['Indiquez la part du prestataire.']],
            ], 422);
        }

        $faite = DB::transaction(function () use ($demande, $d, $part, $prestataire, $request) {
            $verrouillee = DemandeService::query()->lockForUpdate()->findOrFail($demande->id);
            if ($verrouillee->encaisse_le !== null) {
                return false;
            }

            $verrouillee->forceFill([
                'montant_encaisse'       => $d['montant'],
                'part_prestataire'       => $part,
                'prestataire'            => $prestataire,
                'moyen_encaissement'     => $d['moyen'],
                'reference_encaissement' => filled($d['reference'] ?? null) ? trim($d['reference']) : null,
                'encaisse_le'            => $d['recu_le'],
                'encaisse_par'           => $request->user()->id,
            ]);
            // Un service payé est un service confirmé : il sort de la file des réponses à faire.
            if ($verrouillee->statut === 'nouvelle') {
                $verrouillee->statut = 'traitee';
                $verrouillee->traitee_le = now();
                $verrouillee->traitee_par = $request->user()->id;
            }
            $verrouillee->save();

            return true;
        });

        if (! $faite) {
            return response()->json(['message' => 'Le paiement de cette demande est déjà enregistré.'], 409);
        }

        $this->consignerArgent($request, $demande, 'demande_service.encaissement', [
            'montant' => $d['montant'], 'part_prestataire' => $part, 'moyen' => $d['moyen'],
        ]);

        return response()->json($demande->fresh()->load('traiteePar:id,name'));
    }

    /** Une erreur de saisie se défait, tant que la part n'a pas été reversée. */
    public function annulerEncaissement(Request $request, DemandeService $demande): JsonResponse
    {
        if ($demande->encaisse_le === null) {
            return response()->json(['message' => 'Aucun paiement n’est enregistré sur cette demande.'], 409);
        }
        if ($demande->reverse_le !== null) {
            return response()->json(['message' => 'La part a déjà été reversée : annulez d’abord le reversement.'], 409);
        }

        $avant = $demande->encaissement;
        $demande->forceFill([
            'montant_encaisse' => null, 'part_prestataire' => null, 'prestataire' => null,
            'moyen_encaissement' => null, 'reference_encaissement' => null,
            'encaisse_le' => null, 'encaisse_par' => null,
        ])->save();

        $this->consignerArgent($request, $demande, 'demande_service.encaissement_annule', $avant ?? []);

        return response()->json($demande->fresh()->load('traiteePar:id,name'));
    }

    /** La part a été versée au prestataire : elle cesse d'être à garder. */
    public function reverser(Request $request, DemandeService $demande): JsonResponse
    {
        $d = $request->validate([
            'reverse_le' => 'required|date|before_or_equal:today',
            'reference'  => 'nullable|string|max:80',
        ]);

        if ($demande->encaisse_le === null) {
            return response()->json(['message' => 'Le client n’a pas encore payé : il n’y a rien à reverser.'], 409);
        }
        if ($demande->reverse_le !== null) {
            return response()->json(['message' => 'Cette part est déjà reversée.'], 409);
        }
        if (Carbon::parse($d['reverse_le'])->lt($demande->encaisse_le)) {
            return response()->json([
                'message' => 'Le reversement ne peut pas précéder le paiement du client.',
                'errors'  => ['reverse_le' => ['Le reversement ne peut pas précéder le paiement du client.']],
            ], 422);
        }

        $demande->forceFill([
            'reverse_le'            => $d['reverse_le'],
            'reference_reversement' => filled($d['reference'] ?? null) ? trim($d['reference']) : null,
            'reverse_par'           => $request->user()->id,
        ])->save();

        $this->consignerArgent($request, $demande, 'demande_service.reversement', [
            'part_prestataire' => $demande->part_prestataire, 'prestataire' => $demande->prestataire,
        ]);

        return response()->json($demande->fresh()->load('traiteePar:id,name'));
    }

    public function annulerReversement(Request $request, DemandeService $demande): JsonResponse
    {
        if ($demande->reverse_le === null) {
            return response()->json(['message' => 'Aucun reversement n’est enregistré sur cette demande.'], 409);
        }

        $demande->forceFill(['reverse_le' => null, 'reference_reversement' => null, 'reverse_par' => null])->save();

        $this->consignerArgent($request, $demande, 'demande_service.reversement_annule', [
            'part_prestataire' => $demande->part_prestataire,
        ]);

        return response()->json($demande->fresh()->load('traiteePar:id,name'));
    }

    /* ══ Interne ══════════════════════════════════════════════════ */

    /** @param  array<string, mixed>  $details */
    private function consignerArgent(Request $request, DemandeService $demande, string $action, array $details): void
    {
        JournalAdmin::consigner(
            $request->user(),
            $action,
            $demande,
            "{$demande->reference} — {$demande->libelle_prestation}",
            $details,
            $request->ip(),
        );
    }

    private function prevenirLAdministration(DemandeService $demande): void
    {
        $quand = Carbon::parse($demande->date_service)->locale('fr')->isoFormat('D MMM');

        foreach (User::where('role', 'admin')->get() as $admin) {
            $this->push->versUtilisateur($admin, [
                'titre'  => 'Demande de service — '.$demande->libelle_prestation,
                'corps'  => "{$demande->nom} · {$quand} · {$demande->personnes} pers. · {$demande->telephone}",
                'url'    => '/admin/demandes',
                'groupe' => "demande-service-{$demande->id}",
            ]);
        }
    }
}
