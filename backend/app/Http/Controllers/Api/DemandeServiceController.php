<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DemandeService;
use App\Models\JournalAdmin;
use App\Models\User;
use App\Services\Prestations;
use App\Services\Push;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Les services aux voyageurs : transport et repas.
 *
 * Une demande, pas une réservation : le visiteur dit ce dont il a besoin, la
 * demande est gardée ici, et la réponse se fait sur WhatsApp. Rien n'est
 * encaissé, aucun prestataire n'est engagé — c'est ce qui permet d'ouvrir en
 * quelques jours, avant que les prix soient négociés avec chacun.
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

        $catalogue = collect(config('prestations.catalogue'))
            ->filter(fn (array $p) => in_array($p['famille'], $familles, true))
            ->map(fn (array $p, string $cle) => ['cle' => $cle] + $p)
            ->values();

        $ouvertes = Prestations::famillesOuvertes();

        return response()->json([
            'familles' => collect($familles)
                ->mapWithKeys(fn (string $f) => [$f => config("prestations.familles.{$f}.libelle")]),
            'catalogue' => $catalogue,
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
            'telephone'    => ['required', 'string', 'max:30', 'regex:/^\+?[0-9 ().-]+$/', function ($attribut, $valeur, $echec) {
                // Huit chiffres au moins : en deçà, ce n'est un numéro nulle part,
                // et on ne pourrait pas rappeler la famille.
                if (strlen(preg_replace('/\D/', '', (string) $valeur)) < 8) {
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
            'telephone.regex'             => 'Le numéro ne doit contenir que des chiffres, des espaces et le signe +.',
        ]);

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

    public function indexAdmin(Request $request): JsonResponse
    {
        $request->validate([
            'statut'   => 'sometimes|nullable|in:'.implode(',', array_keys(DemandeService::STATUTS)),
            'par_page' => 'sometimes|integer|min:5|max:100',
        ]);

        return response()->json(
            DemandeService::query()
                ->with('traiteePar:id,name')
                ->when($request->filled('statut'), fn ($q) => $q->where('statut', $request->input('statut')))
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

    /* ══ Interne ══════════════════════════════════════════════════ */

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
