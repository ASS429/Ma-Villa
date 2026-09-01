<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Commande;
use App\Models\Oeuvre;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * La vitrine de la boutique, et son administration.
 *
 * PasseTemps est le seul vendeur : il n'y a donc ni modération ni cloisonnement
 * par compte. Publier un article est une action d'administration, point.
 */
class OeuvreController extends Controller
{
    /**
     * La boutique fermée répond 404, pas 503.
     *
     * Un 503 dirait « ça existe, revenez plus tard » et inviterait les moteurs
     * à garder l'adresse. Tant que le métier n'est pas ouvert, ces URL ne
     * doivent pas exister du tout.
     */
    private function exigerBoutiqueOuverte(): void
    {
        if (! config('boutique.actif')) {
            throw new NotFoundHttpException();
        }
    }

    /* ══ Public ═══════════════════════════════════════════════════ */

    public function index(Request $request): JsonResponse
    {
        $this->exigerBoutiqueOuverte();

        $request->validate([
            'categorie' => 'sometimes|nullable|in:'.implode(',', array_keys((array) config('boutique.categories'))),
            'artiste'   => 'sometimes|nullable|string|max:120',
            'q'         => 'sometimes|nullable|string|max:120',
            'tri'       => 'sometimes|in:recent,prix_asc,prix_desc',
            'par_page'  => 'sometimes|integer|min:6|max:48',
        ], [
            'categorie.in' => 'Cette catégorie n\'existe pas.',
        ]);

        $oeuvres = Oeuvre::query()
            ->visible()
            ->with('photos')
            ->when($request->filled('categorie'), fn ($q) => $q->deCategorie($request->input('categorie')))
            ->when($request->filled('artiste'), fn ($q) => $q->where('artiste', $request->input('artiste')))
            ->when($request->filled('q'), function ($q) use ($request) {
                $terme = '%'.$request->input('q').'%';
                $q->where(fn ($w) => $w->where('titre', 'like', $terme)
                                       ->orWhere('artiste', 'like', $terme)
                                       ->orWhere('technique', 'like', $terme));
            });

        // Les articles encore disponibles d'abord : une vitrine qui ouvre sur ce
        // qui est déjà vendu se lit comme une boutique vide.
        $oeuvres->orderByRaw("CASE WHEN statut = 'publiee' AND stock > 0 THEN 0 ELSE 1 END");

        match ($request->input('tri', 'recent')) {
            'prix_asc'  => $oeuvres->orderBy('prix'),
            'prix_desc' => $oeuvres->orderByDesc('prix'),
            default     => $oeuvres->orderByDesc('vedette')->latest(),
        };

        /*
         | « À partir de » doit porter sur **tout** ce que la sélection contient,
         | et sur ce qui est **réellement achetable**.
         |
         | Calculé côté écran, il ne voyait que la page courante et annonçait un
         | prix plancher plus élevé que le vrai. Il aurait aussi pu annoncer le
         | prix d'un article épuisé — une promesse qu'on ne peut pas tenir.
         */
        $prixMin = (clone $oeuvres)
            ->reorder()
            ->where('statut', 'publiee')
            ->where('stock', '>', 0)
            ->min('prix');

        // Fusionné sur le tableau du paginateur : `additional()` appartient aux
        // ressources d'API, pas au paginateur lui-même.
        return response()->json(
            $oeuvres->paginate($request->integer('par_page', 12))->toArray()
            + ['prix_min' => $prixMin !== null ? (int) $prixMin : null]
        );
    }

    public function show(Oeuvre $oeuvre): JsonResponse
    {
        $this->exigerBoutiqueOuverte();

        // Un brouillon n'existe pas pour le public. 404 plutôt que 403 : dire
        // « interdit » confirmerait qu'un article se prépare à cette adresse.
        if ($oeuvre->statut === 'brouillon' && ! $this->estAdmin()) {
            throw new NotFoundHttpException();
        }

        return response()->json($oeuvre->load('photos'));
    }

    /** Les artistes représentés, pour le filtre de la vitrine. */
    public function artistes(): JsonResponse
    {
        $this->exigerBoutiqueOuverte();

        return response()->json(
            Oeuvre::visible()->distinct()->orderBy('artiste')->pluck('artiste')
        );
    }

    /**
     * Les catégories, avec ce qu'elles contiennent réellement.
     *
     * Une catégorie vide n'est pas proposée : un filtre qui ne rend rien use
     * la confiance plus vite qu'il ne rend service. L'ordre reste celui de la
     * configuration, qui est délibéré.
     */
    public function categories(): JsonResponse
    {
        $this->exigerBoutiqueOuverte();

        $comptes = Oeuvre::visible()
            ->selectRaw('categorie, COUNT(*) as total')
            ->groupBy('categorie')
            ->pluck('total', 'categorie');

        $categories = collect((array) config('boutique.categories'))
            ->map(fn (array $c, string $cle) => [
                'cle'     => $cle,
                'nom'     => $c['nom'],
                'pluriel' => $c['pluriel'],
                'total'   => (int) ($comptes[$cle] ?? 0),
            ])
            ->filter(fn (array $c) => $c['total'] > 0)
            ->values();

        return response()->json($categories);
    }

    /* ══ Administration ═══════════════════════════════════════════ */

    /** Tout, brouillons compris — c'est l'écran de gestion du stock. */
    public function indexAdmin(Request $request): JsonResponse
    {
        $request->validate([
            'statut'   => 'sometimes|nullable|in:brouillon,publiee,vendue',
            'par_page' => 'sometimes|integer|min:5|max:100',
        ]);

        return response()->json(
            Oeuvre::query()
                ->with('photos')
                ->withCount(['commandes as commandes_actives' => fn ($q) => $q->immobilisante()])
                ->when($request->filled('statut'), fn ($q) => $q->where('statut', $request->input('statut')))
                ->latest()
                ->paginate($request->integer('par_page', 20))
        );
    }

    public function store(Request $request): JsonResponse
    {
        $oeuvre = Oeuvre::create($this->valider($request));

        return response()->json($oeuvre->load('photos'), 201);
    }

    public function update(Request $request, Oeuvre $oeuvre): JsonResponse
    {
        $donnees = $this->valider($request, partiel: true);

        // Remettre en vente un article épuisé sans lui redonner de stock le
        // rendrait commandable alors qu'il n'en reste rien. Réapprovisionner
        // suffit — et pour une pièce unique, il n'y a rien à réapprovisionner :
        // le seul chemin légitime reste l'annulation de la commande.
        $stockApres = $donnees['stock'] ?? $oeuvre->stock;

        if ($oeuvre->statut === 'vendue'
            && ($donnees['statut'] ?? null) === 'publiee'
            && $stockApres < 1) {
            return response()->json([
                'message' => 'Cet article est épuisé. Indiquez un stock pour le remettre en vente, '
                           ."ou annulez la commande s'il s'agit d'une pièce unique.",
            ], 422);
        }

        $oeuvre->update($donnees);

        // Réapprovisionner un article épuisé le remet en vente de lui-même :
        // saisir un stock puis devoir changer le statut serait deux gestes
        // pour une seule intention.
        if ($oeuvre->statut === 'vendue' && $oeuvre->stock > 0 && ! isset($donnees['statut'])) {
            $oeuvre->update(['statut' => 'publiee']);
        }

        return response()->json($oeuvre->load('photos'));
    }

    /**
     * Un article commandé ne se supprime pas.
     *
     * La contrainte de base de données le refuserait de toute façon, mais elle
     * répondrait par une erreur serveur illisible. Mieux vaut dire pourquoi.
     */
    public function destroy(Oeuvre $oeuvre): JsonResponse
    {
        if ($oeuvre->commandes()->exists()) {
            return response()->json([
                'message' => 'Cet article a déjà été commandé : il ne peut plus être supprimé. '
                           .'Repassez-le en brouillon pour le retirer de la vitrine.',
            ], 422);
        }

        $oeuvre->photos()->delete();
        $oeuvre->delete();

        return response()->json(['message' => 'Article supprimé.']);
    }

    /** @return array<string, mixed> */
    private function valider(Request $request, bool $partiel = false): array
    {
        $requis = $partiel ? 'sometimes' : 'required';

        return $request->validate([
            'titre'       => "{$requis}|string|max:160",
            'artiste'     => "{$requis}|string|max:120",
            'categorie'   => "{$requis}|in:".implode(',', array_keys((array) config('boutique.categories'))),
            'prix'        => "{$requis}|integer|min:1|max:100000000",
            'stock'       => 'sometimes|integer|min:0|max:9999',
            'description' => 'sometimes|nullable|string|max:4000',
            'technique'   => 'sometimes|nullable|string|max:120',
            'dimensions'  => 'sometimes|nullable|string|max:80',
            'annee'       => 'sometimes|nullable|integer|min:1800|max:'.(date('Y') + 1),
            'statut'      => 'sometimes|in:brouillon,publiee,vendue',
            'vedette'     => 'sometimes|boolean',
        ]);
    }

    private function estAdmin(): bool
    {
        return (request()->user() ?? auth('sanctum')->user())?->role === 'admin';
    }
}
