<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VillaRequest;
use App\Models\Reservation;
use App\Models\Villa;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class VillaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'ville'          => 'nullable|string|max:100',
            'prix_min'       => 'nullable|numeric|min:0',
            'prix_max'       => 'nullable|numeric|min:0',
            'type_logement'  => 'nullable|in:villa_entiere,appartement,chambre,piscine',
            'note_min'       => 'nullable|numeric|between:1,5',
            'date_debut'     => 'nullable|date',
            'date_fin'       => 'nullable|date|after_or_equal:date_debut',
            'capacite'       => 'nullable|integer|min:1',
            'tri'            => 'nullable|in:recent,prix_asc,prix_desc,note',
        ]);

        $query = Villa::query()
            ->where('statut', 'validee')
            ->with('photos')
            // Agrégats affichés sur la carte de villa : sans eux le prix
            // n'apparaît nulle part dans la liste.
            ->withMin('tarifs as prix_min', 'prix')
            ->withAvg('avis as note_moyenne', 'note')
            ->withCount('avis')
            ->withMax('logements as capacite_max', 'capacite');

        if ($request->ville) {
            $query->where('ville', 'like', "%{$request->ville}%");
        }

        if ($request->filled('prix_min') || $request->filled('prix_max')) {
            $query->whereHas('logements.tarifs', function ($q) use ($request) {
                if ($request->filled('prix_min')) $q->where('prix', '>=', $request->prix_min);
                if ($request->filled('prix_max')) $q->where('prix', '<=', $request->prix_max);
            });
        }

        if ($request->type_logement) {
            $query->whereHas('logements', fn ($q) => $q->where('type', $request->type_logement));
        }

        if ($request->filled('capacite')) {
            $query->whereHas('logements', fn ($q) => $q->where('capacite', '>=', $request->capacite));
        }

        if ($request->filled('note_min')) {
            // PostgreSQL (la base de production) n'autorise pas un alias de
            // SELECT dans HAVING : on rejoue la sous-requête dans le WHERE.
            // Une villa sans avis ne remonte pas quand on filtre sur la note.
            // La valeur est écrite en littéral plutôt que liée : PDO transmet
            // toute liaison en chaîne, et comparée à une expression (donc sans
            // affinité de colonne) elle serait traitée comme du texte — en
            // SQLite tout nombre est alors inférieur à toute chaîne, et le
            // filtre ne renverrait jamais rien.
            // Aucune injection possible : la valeur est validée `numeric` et
            // reformatée avec %F, insensible à la locale (« 4,5 » sinon).
            $note = sprintf('%F', (float) $request->note_min);

            $query->whereRaw(
                "(select coalesce(avg(avis.note), 0) from avis where avis.villa_id = villas.id) >= {$note}"
            );
        }

        if ($request->boolean('vedette')) {
            $query->where('vedette', true);
        }

        // Recherche par dates : ne garder que les villas ayant au moins un
        // logement réellement libre sur toute la période.
        if ($request->filled('date_debut') && $request->filled('date_fin')) {
            $query->whereHas(
                'logements',
                fn ($q) => $this->scopeLogementsLibres($q, $request->date_debut, $request->date_fin)
            );
        }

        // Les alias de SELECT (prix_min, note_moyenne) ne sont pas réutilisables
        // dans une expression ORDER BY sur PostgreSQL : on trie sur des
        // sous-requêtes corrélées. Le COALESCE renvoie systématiquement les
        // villas sans tarif ni avis en fin de liste, quel que soit le moteur.
        match ($request->tri) {
            'prix_asc'  => $query->orderBy($this->sousRequetePrix('999999999'), 'asc'),
            'prix_desc' => $query->orderBy($this->sousRequetePrix('-1'), 'desc'),
            'note'      => $query->orderBy($this->sousRequeteNote(), 'desc'),
            default     => $query->latest('villas.created_at'),
        };

        return response()->json($query->paginate(12)->withQueryString());
    }

    /** Prix le plus bas de la villa ; $defaut place les villas sans tarif en fin de tri. */
    private function sousRequetePrix(string $defaut)
    {
        return DB::table('tarifs')
            ->selectRaw("coalesce(min(tarifs.prix), {$defaut})")
            ->join('logements', 'logements.id', '=', 'tarifs.logement_id')
            ->whereColumn('logements.villa_id', 'villas.id');
    }

    /** Note moyenne ; les villas sans avis passent derrière les villas notées. */
    private function sousRequeteNote()
    {
        return DB::table('avis')
            ->selectRaw('coalesce(avg(avis.note), -1)')
            ->whereColumn('avis.villa_id', 'villas.id');
    }

    /**
     * Restreint aux logements disponibles et libres sur la période :
     * ni réservation bloquante, ni plage marquée indisponible.
     */
    private function scopeLogementsLibres(Builder $query, string $debut, string $fin): Builder
    {
        return $query
            ->where('disponible', true)
            ->whereDoesntHave(
                'reservations',
                fn ($r) => $r->bloquante()->chevauchant($debut, $fin)
            )
            ->whereDoesntHave('disponibilites', fn ($d) => $d
                ->where('disponible', false)
                ->where('date_debut', '<=', $fin)
                ->where('date_fin', '>=', $debut));
    }

    public function mesVillas(Request $request): JsonResponse
    {
        $villas = $request->user()->villas()
            ->with('photos')
            ->withMin('tarifs as prix_min', 'prix')
            ->withAvg('avis as note_moyenne', 'note')
            ->withCount('avis')
            ->latest()
            ->get();

        return response()->json($villas);
    }

    public function store(VillaRequest $request): JsonResponse
    {
        $villa = $request->user()->villas()->create($request->validated());

        return response()->json($villa, 201);
    }

    public function show(Request $request, Villa $villa): JsonResponse
    {
        // Une villa en attente ou rejetée ne doit pas être publiquement
        // consultable : sinon la modération admin ne protège rien. Le
        // propriétaire et l'admin y accèdent pour la prévisualisation.
        if ($villa->statut !== 'validee' && ! $this->peutPrevisualiser($request, $villa)) {
            throw new NotFoundHttpException();
        }

        $villa->load(['logements.tarifs', 'photos', 'avis.client', 'proprietaire'])
              ->loadMin('tarifs as prix_min', 'prix')
              ->loadAvg('avis as note_moyenne', 'note')
              ->loadCount('avis');

        return response()->json($villa);
    }

    /**
     * Dates déjà occupées pour chaque logement de la villa, afin que le client
     * choisisse ses dates en connaissance de cause plutôt que de découvrir le
     * conflit après soumission.
     */
    public function occupation(Villa $villa): JsonResponse
    {
        abort_if($villa->statut !== 'validee', 404);

        $logementIds = $villa->logements()->pluck('id');

        $reservations = Reservation::whereIn('logement_id', $logementIds)
            ->bloquante()
            ->where('date_fin', '>=', now()->toDateString())
            ->get(['logement_id', 'date_debut', 'date_fin']);

        $blocages = \App\Models\Disponibilite::whereIn('logement_id', $logementIds)
            ->where('disponible', false)
            ->where('date_fin', '>=', now()->toDateString())
            ->get(['logement_id', 'date_debut', 'date_fin']);

        return response()->json(
            $reservations->concat($blocages)
                ->groupBy('logement_id')
                ->map(fn ($plages) => $plages->map(fn ($p) => [
                    'date_debut' => $p->date_debut instanceof \DateTimeInterface
                        ? $p->date_debut->format('Y-m-d') : $p->date_debut,
                    'date_fin'   => $p->date_fin instanceof \DateTimeInterface
                        ? $p->date_fin->format('Y-m-d') : $p->date_fin,
                ])->values())
        );
    }

    public function update(VillaRequest $request, Villa $villa): JsonResponse
    {
        $this->authorize('update', $villa);
        $villa->update($request->validated());

        return response()->json($villa);
    }

    public function destroy(Villa $villa): JsonResponse
    {
        $this->authorize('delete', $villa);
        $villa->delete();

        return response()->json(['message' => 'Villa supprimée.']);
    }

    /**
     * La route est publique : le jeton éventuel doit être résolu explicitement
     * sur le garde sanctum, sinon $request->user() renverrait toujours null.
     */
    private function peutPrevisualiser(Request $request, Villa $villa): bool
    {
        $user = $request->user() ?? auth('sanctum')->user();

        return $user !== null
            && ($user->id === $villa->user_id || $user->role === 'admin');
    }
}
