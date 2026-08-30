<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VillaRequest;
use App\Models\Logement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\Villa;
use App\Services\Commission;
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
            // `type_logement` reste accepté le temps que les liens partagés
            // avec l'ancien paramètre cessent de circuler.
            'type_logement'  => 'nullable|in:villa_entiere,appartement,residence,chambre,piscine',
            'categorie'      => 'nullable|string|exists:categories,cle',
            'meuble'         => 'nullable|boolean',
            'note_min'       => 'nullable|numeric|between:1,5',
            'date_debut'     => 'nullable|date',
            'date_fin'       => 'nullable|date|after_or_equal:date_debut',
            'capacite'       => 'nullable|integer|min:1',
            'tri'            => 'nullable|in:recent,prix_asc,prix_desc,note',
        ]);

        $query = Villa::query()
            ->where('statut', 'validee')
            ->with('photos')
            // La liste ne porte pas le numéro de la villa : publié, il permet
            // d'appeler et de convenir d'un séjour hors plateforme. Il n'a de
            // toute façon aucun usage sur une carte de résultat.
            ->withoutTelephone()
            // Agrégats affichés sur la carte de villa : sans eux le prix
            // n'apparaît nulle part dans la liste.
            ->withMin('tarifs as prix_min', 'prix')
            ->withAvg('avis as note_moyenne', 'note')
            ->withCount('avis')
            ->withMax('logements as capacite_max', 'capacite')
            // Équipements affichés sur la carte de villa. Ils ne sont pas
            // stockés tels quels : ils se déduisent des logements et des
            // formules tarifaires, sans charger toute l'arborescence.
            // EXISTS plutôt qu'un SELECT 1 limité : ce dernier renvoyait `null`
            // en l'absence de résultat, si bien que le champ valait tantôt
            // true, tantôt null — jamais false. EXISTS renvoie toujours une
            // valeur, que le transtypage du modèle ramène à un booléen sur les
            // trois moteurs. L'alias vit dans le SQL : `addSelect` ne sait pas
            // nommer une expression brute par clé de tableau.
            ->addSelect(DB::raw(
                "(exists (select 1 from logements"
                ." where logements.villa_id = villas.id and logements.type = 'piscine'))"
                .' as a_piscine'
            ))
            ->addSelect(DB::raw(
                '(exists (select 1 from tarifs'
                .' inner join logements as l_clim on l_clim.id = tarifs.logement_id'
                .' where l_clim.villa_id = villas.id and tarifs.avec_clim = true))'
                .' as a_climatisation'
            ))
            ->addSelect([
                // Unité du tarif le moins cher : « à partir de 45 000 FCFA »
                // n'a pas le même sens à la nuitée qu'à la demi-journée.
                'prix_min_unite' => Tarif::select('tarifs.type_tarif')
                    ->join('logements as l_unite', 'l_unite.id', '=', 'tarifs.logement_id')
                    ->whereColumn('l_unite.villa_id', 'villas.id')
                    ->orderBy('tarifs.prix')
                    ->limit(1),
            ]);

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

        if ($request->categorie) {
            $query->whereHas('logements.categorie', fn ($q) => $q->where('cle', $request->categorie));
        }

        if ($request->filled('meuble')) {
            $query->whereHas('logements', fn ($q) => $q->where('meuble', $request->boolean('meuble')));
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

    /**
     * Destinations proposées sur l'accueil : les villes où des villas sont
     * réellement publiées, avec leur nombre d'annonces, le prix d'entrée et une
     * photo représentative. Éviter d'annoncer une ville sans offre derrière.
     */
    public function destinations(): JsonResponse
    {
        $villes = Villa::query()
            ->where('statut', 'validee')
            ->selectRaw('ville, count(*) as nb')
            ->groupBy('ville')
            ->orderByDesc('nb')
            ->limit(6)
            ->get();

        $destinations = $villes->map(function ($ligne) {
            $vitrine = Villa::where('statut', 'validee')
                ->where('ville', $ligne->ville)
                ->with('photos')
                ->withMin('tarifs as prix_min', 'prix')
                ->has('photos')
                ->first()
                ?? Villa::where('statut', 'validee')->where('ville', $ligne->ville)->with('photos')->first();

            return [
                'ville'    => $ligne->ville,
                'nb'       => (int) $ligne->nb,
                'prix_min' => $vitrine?->prix_min,
                'photo'    => $vitrine?->photos->first()?->url,
            ];
        });

        return response()->json($destinations);
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

    /**
     * Ouvre un brouillon.
     *
     * Un nom et une ville suffisent. Le reste s'ajoute étape par étape, et
     * chaque étape est enregistrée : l'abandon devient réversible au lieu
     * d'être empêché. Tant que l'annonce est un brouillon, elle n'existe ni
     * pour le public ni pour la modération.
     */
    public function store(VillaRequest $request): JsonResponse
    {
        $villa = $request->user()->villas()->create(
            $request->validated() + ['statut' => 'brouillon']
        );

        return response()->json($villa, 201);
    }

    /**
     * Soumet un brouillon à la modération.
     *
     * C'est **ici** que la complétude se vérifie, et nulle part ailleurs.
     * L'ancien formulaire l'exigeait à la création, ce qui revenait à refuser
     * de commencer tant qu'on n'avait pas fini.
     *
     * Ce qui est exigé est le minimum vendable : de quoi savoir ce qu'on loue
     * (un logement), à quel prix (une formule), et comment joindre le
     * propriétaire. Les photos n'en font pas partie — le plafond de cinq est
     * une limite de stockage, pas un seuil de qualité, et l'utilisateur a
     * explicitement écarté tout plancher.
     */
    public function publier(Request $request, Villa $villa): JsonResponse
    {
        if ($villa->user_id !== $request->user()->id) {
            return response()->json(['message' => "Cette annonce n'est pas la vôtre."], 403);
        }

        if ($villa->statut !== 'brouillon' && $villa->statut !== 'rejetee') {
            return response()->json([
                'message' => $villa->statut === 'validee'
                    ? 'Cette annonce est déjà en ligne.'
                    : 'Cette annonce est déjà soumise à validation.',
            ], 422);
        }

        $manques = $this->ceQuiManque($villa);

        if ($manques !== []) {
            // 422 avec le détail : l'écran affiche l'étape à reprendre plutôt
            // qu'un refus qui laisse chercher.
            return response()->json([
                'message' => 'Il manque encore quelque chose pour publier.',
                'manques' => $manques,
            ], 422);
        }

        $villa->update(['statut' => 'en_attente']);

        return response()->json($villa->fresh());
    }

    /**
     * Ce qu'il manque au brouillon, dit par étape.
     *
     * Chaque entrée porte l'étape concernée : l'écran sait alors où renvoyer,
     * ce qu'une liste de champs ne permettrait pas — « tarif_id manquant » ne
     * dit pas quoi faire.
     */
    private function ceQuiManque(Villa $villa): array
    {
        $manques = [];

        if (blank($villa->adresse)) {
            $manques[] = ['etape' => 'adresse', 'message' => "L'adresse du logement n'est pas renseignée."];
        }

        if (blank($villa->telephone)) {
            $manques[] = ['etape' => 'adresse', 'message' => 'Aucun numéro ne permet de vous joindre.'];
        }

        if (blank($villa->description)) {
            $manques[] = ['etape' => 'description', 'message' => "L'annonce n'a pas de description."];
        }

        $logement = $villa->logements()->withCount('tarifs')->first();

        if (! $logement) {
            $manques[] = ['etape' => 'logement', 'message' => "Aucun logement n'a été décrit."];
        } elseif ($logement->tarifs_count === 0) {
            $manques[] = ['etape' => 'prix', 'message' => 'Aucun tarif n\'a été fixé.'];
        }

        return $manques;
    }

    /**
     * Ce que gagne le propriétaire, et ce qui se pratique autour.
     *
     * Deux chiffres, à l'étape où il hésite le plus. Le **net** d'abord :
     * sans lui, il découvre la commission après la première réservation, ce
     * qui est le meilleur moyen de le perdre. La **fourchette locale**
     * ensuite, et seulement si elle veut dire quelque chose.
     *
     * ⚠️ Le seuil est le point à ne pas perdre. À Ziguinchor avec neuf
     * villas, une fourchette est une invention : un propriétaire qui fixe son
     * prix dessus le regrettera, et c'est nous qui le lui aurons soufflé. En
     * dessous du seuil, on ne renvoie rien — pas une médiane nationale, qui
     * serait fausse dans les deux sens entre Saly et la Casamance.
     */
    public function reperesDePrix(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'ville'          => 'required|string|max:100',
            'prix'           => 'sometimes|nullable|numeric|min:0',
            // Sans ces deux-là, la fourchette compare une piscine à la
            // journée avec une villa entière à la semaine. Le chiffre serait
            // exact et la comparaison absurde — c'est précisément le défaut
            // que le designer signalait.
            'type_tarif'     => 'sometimes|nullable|in:journee,nuitee,demi_journee,pass',
            'type_logement'  => 'sometimes|nullable|in:villa_entiere,appartement,residence,chambre,piscine',
        ]);

        $seuil = (int) config('annonces.reperes_prix_minimum', 10);

        $prix = Tarif::query()
            ->when(filled($donnees['type_tarif'] ?? null),
                fn (Builder $q) => $q->where('type_tarif', $donnees['type_tarif']))
            ->whereHas('logement', fn (Builder $q) => $q
                ->when(filled($donnees['type_logement'] ?? null),
                    fn (Builder $l) => $l->where('type', $donnees['type_logement'])))
            ->whereHas('logement.villa', fn (Builder $q) => $q
                ->where('statut', 'validee')
                ->where('ville', 'like', $donnees['ville']))
            ->orderBy('prix')
            ->pluck('prix')
            ->map(fn ($p) => (int) $p)
            ->values();

        $net = null;
        if (! blank($donnees['prix'] ?? null) && (int) $donnees['prix'] > 0) {
            $repartition = Commission::pour((int) $donnees['prix']);
            $net = [
                'proprietaire' => $repartition->montantProprietaire,
                'commission'   => $repartition->commission,
                'taux'         => round($repartition->taux * 100, 1),
            ];
        }

        if ($prix->count() < $seuil) {
            return response()->json([
                'ville'      => $donnees['ville'],
                'comparable' => false,
                'annonces'   => $prix->count(),
                'seuil'      => $seuil,
                'net'        => $net,
            ]);
        }

        // Les extrêmes d'une petite population sont du bruit : une villa de
        // standing et un studio bradé écraseraient la fourchette. Les quartiles
        // décrivent ce qui se pratique vraiment.
        $quartile = function (float $position) use ($prix) {
            $rang = ($prix->count() - 1) * $position;
            $bas = (int) floor($rang);
            $haut = (int) ceil($rang);

            return $bas === $haut
                ? $prix[$bas]
                : (int) round($prix[$bas] + ($prix[$haut] - $prix[$bas]) * ($rang - $bas));
        };

        return response()->json([
            'ville'      => $donnees['ville'],
            'comparable' => true,
            'annonces'   => $prix->count(),
            'bas'        => $quartile(0.25),
            'haut'       => $quartile(0.75),
            'median'     => $quartile(0.5),
            'net'        => $net,
        ]);
    }

    public function show(Request $request, Villa $villa): JsonResponse
    {
        // Une villa en attente ou rejetée ne doit pas être publiquement
        // consultable : sinon la modération admin ne protège rien. Le
        // propriétaire et l'admin y accèdent pour la prévisualisation.
        if ($villa->statut !== 'validee' && ! $this->peutPrevisualiser($request, $villa)) {
            throw new NotFoundHttpException();
        }

        $villa->load([
                  'logements.tarifs', 'photos', 'avis.client',
                  // Le propriétaire est réduit à ce qu'un visiteur a besoin de
                  // savoir : qui loue. Sans cette restriction, la relation
                  // partait entière — email et téléphone personnel compris,
                  // sur une route publique et sans authentification.
                  'proprietaire:id,name,avatar',
              ])
              ->loadMin('tarifs as prix_min', 'prix')
              ->loadAvg('avis as note_moyenne', 'note')
              ->loadCount('avis');

        // Le numéro de la villa ne s'affiche qu'à ceux qu'il concerne. Publié,
        // il permet d'appeler et de convenir d'un séjour hors plateforme : la
        // commission s'évapore, et la réservation n'est plus tracée — donc ni
        // avis vérifié, ni recours en cas de litige.
        //
        // Le client le reçoit une fois sa réservation confirmée, par email et
        // sur sa fiche de réservation ; d'ici là, la messagerie sert à poser
        // ses questions.
        if (! $this->peutPrevisualiser($request, $villa)) {
            $villa->makeHidden('telephone');
        }

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
