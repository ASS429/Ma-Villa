<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DemandeParticuliere;
use App\Models\JournalAdmin;
use App\Models\Logement;
use App\Models\User;
use App\Models\Villa;
use App\Services\Push;
use App\Services\Telephone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Les demandes particulières, posées depuis une fiche : un événement, un
 * groupe, un séminaire, un long séjour — tout ce qu'une réservation ne sait
 * pas dire. Publique, comme une demande de service : on ne demande pas de
 * compte à quelqu'un qui veut seulement savoir s'il peut fêter un anniversaire.
 */
class DemandeParticuliereController extends Controller
{
    public function __construct(private Push $push) {}

    public function store(Request $request): JsonResponse
    {
        // Le champ piège : on répond comme si de rien n'était.
        if (filled($request->input('site_web'))) {
            return response()->json(['id' => null, 'reference' => null], 201);
        }

        if (is_string($request->input('telephone'))) {
            $request->merge(['telephone' => Telephone::nettoyer($request->input('telephone'))]);
        }

        $d = $request->validate([
            'villa_id'          => 'required|integer|exists:villas,id',
            'type'              => 'required|in:'.implode(',', array_keys(DemandeParticuliere::TYPES)),
            'date_debut'        => 'nullable|date|after_or_equal:today|before:'.now()->addMonths(18)->toDateString(),
            'date_fin'          => 'nullable|date|after_or_equal:date_debut',
            'dates_a_confirmer' => 'sometimes|boolean',
            'personnes_sejour'  => 'nullable|integer|min:1|max:500',
            'invites'           => 'nullable|integer|min:0|max:2000',
            'besoins'           => 'nullable|array|max:10',
            'besoins.*'         => 'string|in:'.implode(',', array_keys(DemandeParticuliere::BESOINS)),
            'budget'            => 'nullable|integer|min:0|max:1000000000',
            'message'           => 'required|string|min:5|max:2000',
            'nom'               => 'required|string|max:120',
            // L'un ou l'autre : sans contact, personne ne peut répondre.
            'telephone'         => ['nullable', 'required_without:email', 'string', 'max:30', 'regex:/^[^\p{L}]+$/u'],
            'email'             => 'nullable|required_without:telephone|email|max:160',
            'langue'            => 'sometimes|in:fr,en',
        ], [
            'date_debut.after_or_equal'  => 'La date ne peut pas être passée.',
            'date_fin.after_or_equal'    => 'Le départ ne peut pas précéder l’arrivée.',
            'message.required'           => 'Décrivez votre demande en quelques mots.',
            'telephone.required_without' => 'Laissez un numéro ou une adresse pour qu’on vous réponde.',
            'email.required_without'     => 'Laissez un numéro ou une adresse pour qu’on vous réponde.',
            'telephone.regex'            => 'Écrivez le numéro en chiffres, sans lettres.',
        ]);

        $villa = Villa::find($d['villa_id']);
        if ($villa?->statut !== 'validee') {
            return response()->json(['message' => 'Cet hébergement n’est plus proposé.'], 409);
        }

        // `array_merge` et non `+` : `+` garderait les besoins tels que reçus, doublons compris.
        $demande = DemandeParticuliere::create(array_merge($d, [
            'user_id' => auth('sanctum')->id(),
            'besoins' => array_values(array_unique($d['besoins'] ?? [])),
            'langue'  => $d['langue'] ?? 'fr',
        ]));

        $this->prevenirLAdministration($demande, $villa);

        return response()->json(['id' => $demande->id, 'reference' => $demande->reference], 201);
    }

    /**
     * Le client dont les dates sont prises demande à être rappelé.
     *
     * Quand le site refuse un devis faute de dates, rien de ce que le client a tapé
     * n'est gardé : il repartait sans suite, et on perdait quelqu'un qui voulait
     * séjourner chez nous. Il peut maintenant le demander, d'un geste. C'est ce geste
     * qui autorise à garder son nom et son numéro : sans lui, on ne garde rien
     * (`DevisRefuse` ne compte qu'un chiffre anonyme).
     *
     * Rangé parmi les demandes particulières : la réponse se fait de la même façon,
     * sur WhatsApp ou par un devis, et elle a déjà sa file, son journal et sa durée.
     */
    public function rappel(Request $request): JsonResponse
    {
        if (filled($request->input('site_web'))) {
            return response()->json(['id' => null, 'reference' => null], 201);
        }

        if (is_string($request->input('telephone'))) {
            $request->merge(['telephone' => Telephone::nettoyer($request->input('telephone'))]);
        }

        $d = $request->validate([
            'logement_id'  => 'required|integer|exists:logements,id',
            'date_debut'   => 'required|date|after_or_equal:today|before:'.now()->addMonths(18)->toDateString(),
            'date_fin'     => 'required|date|after_or_equal:date_debut',
            'nb_personnes' => 'required|integer|min:1|max:200',
            'nom'          => 'required|string|max:160',
            'telephone'    => ['required', 'string', 'max:30', 'regex:/^[^\p{L}]+$/u', Telephone::assezDeChiffres()],
            'email'        => 'nullable|email|max:160',
            'langue'       => 'sometimes|in:fr,en',
            // Le consentement ne se déduit pas : il doit être envoyé, et vrai.
            'consentement' => 'accepted',
        ]);

        $logement = Logement::with('villa')->findOrFail($d['logement_id']);
        if ($logement->villa?->statut !== 'validee') {
            return response()->json(['message' => 'Cet hébergement n’est plus proposé.'], 409);
        }

        $demande = DemandeParticuliere::create([
            'villa_id'         => $logement->villa_id,
            'user_id'          => auth('sanctum')->id(),
            'type'             => 'rappel_dates',
            'date_debut'       => $d['date_debut'],
            'date_fin'         => $d['date_fin'],
            'personnes_sejour' => $d['nb_personnes'],
            'besoins'          => [],
            'message'          => "Les dates demandées pour « {$logement->nom} » étaient prises. Le client demande à être rappelé pour une autre date ou un hébergement proche.",
            'nom'              => $d['nom'],
            'telephone'        => $d['telephone'],
            'email'            => $d['email'] ?? null,
            'langue'           => $d['langue'] ?? 'fr',
        ]);

        $this->prevenirLAdministration($demande, $logement->villa);

        return response()->json(['id' => $demande->id, 'reference' => $demande->reference], 201);
    }

    private function prevenirLAdministration(DemandeParticuliere $demande, Villa $villa): void
    {
        foreach (User::where('role', 'admin')->get() as $admin) {
            $this->push->versUtilisateur($admin, [
                'titre'  => "Demande particulière — {$demande->libelle_type}",
                'corps'  => "{$demande->nom} · {$villa->nom}".($demande->invites ? " · {$demande->invites} invités" : ''),
                'url'    => '/admin/demandes-particulieres',
                'groupe' => "demande-particuliere-{$demande->id}",
            ]);
        }
    }

    /**
     * Supprimer une demande, à la demande de son auteur ou pour retirer une erreur.
     * Elle part pour de bon : sa référence vient de son identifiant, jamais redonné.
     * Le journal garde la référence, pas le nom.
     */
    public function destroy(Request $request, DemandeParticuliere $demande): JsonResponse
    {
        $reference = $demande->reference;
        $type = $demande->libelle_type;

        JournalAdmin::consigner($request->user(), 'demande_particuliere.supprimee', $demande, "{$reference} — {$type}", [], $request->ip());

        $demande->delete();

        return response()->json(['message' => "Demande {$reference} supprimée."]);
    }

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'statut'   => 'sometimes|nullable|in:'.implode(',', array_keys(DemandeParticuliere::STATUTS)),
            'par_page' => 'sometimes|integer|min:5|max:100',
        ]);

        return response()->json(
            DemandeParticuliere::with(['villa:id,nom,ville,quartier', 'traiteePar:id,name'])
                ->when($request->filled('statut'), fn ($q) => $q->where('statut', $request->input('statut')))
                ->latest()
                ->latest('id')
                ->paginate($request->integer('par_page', 20))
        );
    }

    public function show(DemandeParticuliere $demande): JsonResponse
    {
        return response()->json($demande->load(['villa:id,nom,ville,quartier', 'traiteePar:id,name']));
    }

    public function traiter(Request $request, DemandeParticuliere $demande): JsonResponse
    {
        $d = $request->validate([
            'statut' => 'required|in:'.implode(',', array_keys(DemandeParticuliere::STATUTS)),
        ]);

        $avant = $demande->statut;
        $demande->statut = $d['statut'];
        $demande->traitee_le = $d['statut'] === 'nouvelle' ? null : now();
        $demande->traitee_par = $d['statut'] === 'nouvelle' ? null : $request->user()->id;
        $demande->save();

        JournalAdmin::consigner(
            $request->user(),
            'demande_particuliere.statut',
            $demande,
            "{$demande->reference} — {$demande->libelle_type}",
            ['statut_avant' => $avant, 'statut_apres' => $demande->statut],
            $request->ip(),
        );

        return response()->json($demande->fresh()->load(['villa:id,nom,ville,quartier', 'traiteePar:id,name']));
    }
}
