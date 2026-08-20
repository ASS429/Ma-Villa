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
 * Ma Villa est le seul vendeur : il n'y a donc ni modération ni cloisonnement
 * par compte. Publier une œuvre est une action d'administration, point.
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
            'artiste'  => 'sometimes|nullable|string|max:120',
            'q'        => 'sometimes|nullable|string|max:120',
            'tri'      => 'sometimes|in:recent,prix_asc,prix_desc',
            'par_page' => 'sometimes|integer|min:6|max:48',
        ]);

        $oeuvres = Oeuvre::query()
            ->visible()
            ->with('photos')
            ->when($request->filled('artiste'), fn ($q) => $q->where('artiste', $request->input('artiste')))
            ->when($request->filled('q'), function ($q) use ($request) {
                $terme = '%'.$request->input('q').'%';
                $q->where(fn ($w) => $w->where('titre', 'like', $terme)
                                       ->orWhere('artiste', 'like', $terme)
                                       ->orWhere('technique', 'like', $terme));
            });

        // Les œuvres encore disponibles d'abord : une vitrine qui ouvre sur ce
        // qui est déjà vendu se lit comme une boutique vide.
        $oeuvres->orderByRaw("CASE WHEN statut = 'publiee' THEN 0 ELSE 1 END");

        match ($request->input('tri', 'recent')) {
            'prix_asc'  => $oeuvres->orderBy('prix'),
            'prix_desc' => $oeuvres->orderByDesc('prix'),
            default     => $oeuvres->orderByDesc('vedette')->latest(),
        };

        return response()->json($oeuvres->paginate($request->integer('par_page', 12)));
    }

    public function show(Oeuvre $oeuvre): JsonResponse
    {
        $this->exigerBoutiqueOuverte();

        // Un brouillon n'existe pas pour le public. 404 plutôt que 403 : dire
        // « interdit » confirmerait qu'une œuvre se prépare à cette adresse.
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

        // Repasser une œuvre vendue en « publiée » la remettrait en vente
        // alors qu'elle est partie. Le seul chemin légitime est l'annulation
        // de la commande, qui s'en charge elle-même.
        if ($oeuvre->statut === 'vendue' && ($donnees['statut'] ?? null) === 'publiee') {
            return response()->json([
                'message' => 'Cette œuvre est vendue. Annulez la commande concernée pour la remettre en vente.',
            ], 422);
        }

        $oeuvre->update($donnees);

        return response()->json($oeuvre->load('photos'));
    }

    /**
     * Une œuvre commandée ne se supprime pas.
     *
     * La contrainte de base de données le refuserait de toute façon, mais elle
     * répondrait par une erreur serveur illisible. Mieux vaut dire pourquoi.
     */
    public function destroy(Oeuvre $oeuvre): JsonResponse
    {
        if ($oeuvre->commandes()->exists()) {
            return response()->json([
                'message' => 'Cette œuvre a déjà été commandée : elle ne peut plus être supprimée. '
                           .'Repassez-la en brouillon pour la retirer de la vitrine.',
            ], 422);
        }

        $oeuvre->photos()->delete();
        $oeuvre->delete();

        return response()->json(['message' => 'Œuvre supprimée.']);
    }

    /** @return array<string, mixed> */
    private function valider(Request $request, bool $partiel = false): array
    {
        $requis = $partiel ? 'sometimes' : 'required';

        return $request->validate([
            'titre'       => "{$requis}|string|max:160",
            'artiste'     => "{$requis}|string|max:120",
            'prix'        => "{$requis}|integer|min:1|max:100000000",
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
