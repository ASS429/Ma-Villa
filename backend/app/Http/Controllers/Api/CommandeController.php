<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Commande;
use App\Models\JournalAdmin;
use App\Models\Oeuvre;
use App\Services\PayDunya;
use App\Services\Push;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Commander un article.
 *
 * Deux règles gouvernent tout ce fichier, et ce sont les deux seules qui
 * coûtent réellement quelque chose si on les manque :
 *
 * 1. **Aucun montant ne vient de la requête.** Le prix est lu sur l'article, les
 *    frais de livraison dans la configuration. C'est la leçon de la faille du
 *    tarif, où le client choisissait ce qu'il payait.
 * 2. **Un article ne se vend qu'une fois.** La ligne est verrouillée avant
 *    d'être vendue : deux acheteurs simultanés sur la dernière toile est le
 *    seul incident qu'une galerie ne peut pas rattraper.
 */
class CommandeController extends Controller
{
    public function __construct(
        private readonly PayDunya $paydunya,
        private readonly Push $push,
    ) {
    }

    private function exigerBoutiqueOuverte(): void
    {
        if (! config('boutique.actif')) {
            throw new NotFoundHttpException();
        }
    }

    /* ══ Côté client ══════════════════════════════════════════════ */

    public function index(Request $request): JsonResponse
    {
        $this->exigerBoutiqueOuverte();

        return response()->json(
            Commande::where('user_id', $request->user()->id)
                ->with('oeuvre.photos')
                ->latest()
                ->get()
        );
    }

    public function show(Request $request, Commande $commande): JsonResponse
    {
        $this->exigerBoutiqueOuverte();
        $this->exigerAcces($request, $commande);

        return response()->json($commande->load('oeuvre.photos'));
    }

    /**
     * Passer commande.
     *
     * La création et la mise en vendu de l'article tiennent dans une seule
     * transaction, la ligne verrouillée : sans cela, deux requêtes concurrentes
     * liraient toutes deux « publiée » et vendraient deux fois la même pièce.
     */
    public function store(Request $request): JsonResponse
    {
        $this->exigerBoutiqueOuverte();

        $zones = (array) config('boutique.livraison.zones');

        $modes = config('boutique.paiement_a_la_livraison') ? 'en_ligne,livraison' : 'en_ligne';

        $donnees = $request->validate([
            'oeuvre_id'      => 'required|exists:oeuvres,id',
            'zone_livraison' => 'required|in:'.implode(',', array_keys($zones)),
            'mode_paiement'  => 'required|in:'.$modes,
            'destinataire'   => 'required|string|max:120',
            'telephone'      => 'required|string|max:30',
            'adresse'        => 'required|string|max:500',
            'ville'          => 'required|string|max:120',
            'note'           => 'sometimes|nullable|string|max:500',
        ], [
            'mode_paiement.in' => 'Ce moyen de règlement n\'est pas proposé.',
            'zone_livraison.in' => 'Cette zone de livraison n\'est pas desservie.',
        ]);

        $resultat = DB::transaction(function () use ($donnees, $zones, $request) {
            $oeuvre = Oeuvre::whereKey($donnees['oeuvre_id'])->lockForUpdate()->first();

            if (! $oeuvre || ! $oeuvre->estAchetable()) {
                return null;
            }

            $frais = (int) ($zones[$donnees['zone_livraison']]['frais'] ?? 0);

            $commande = Commande::create([
                'user_id'         => $request->user()->id,
                'oeuvre_id'       => $oeuvre->id,
                // Figés à la commande : un changement de prix ne doit jamais
                // réécrire une vente passée.
                'oeuvre_titre'    => $oeuvre->titre,
                'oeuvre_artiste'  => $oeuvre->artiste,
                'montant_oeuvre'  => $oeuvre->prix,
                'zone_livraison'  => $donnees['zone_livraison'],
                'frais_livraison' => $frais,
                'montant_total'   => $oeuvre->prix + $frais,
                'destinataire'    => $donnees['destinataire'],
                'telephone'       => $donnees['telephone'],
                'adresse'         => $donnees['adresse'],
                'ville'           => $donnees['ville'],
                'note'            => $donnees['note'] ?? null,
                'mode_paiement'   => $donnees['mode_paiement'],
                // Pose explicitement plutot que de compter sur le defaut de
                // la base : l'instance renvoyee juste apres la creation ne le
                // porterait pas, et l'ecran lirait un statut nul.
                'statut_paiement' => 'en_attente',
                // Payer à la livraison confirme d'emblée : l'acheteur s'est
                // engagé, et c'est cet engagement qui retire l'article de la vente.
                'statut'          => $donnees['mode_paiement'] === 'livraison' ? 'confirmee' : 'en_attente',
                'reference'       => 'MV-ART-'.Str::upper(Str::random(8)),
            ]);

            // L'exemplaire quitte le stock dès la commande, avant même le
            // paiement. Attendre le règlement laisserait une fenêtre pendant
            // laquelle un second acheteur peut prendre le même.
            //
            // À zéro, l'article passe « vendu » : il reste visible en vitrine,
            // mais ne s'achète plus. Pour une pièce unique — stock à 1 — c'est
            // exactement le comportement d'origine.
            $oeuvre->decrement('stock');
            if ($oeuvre->fresh()->stock <= 0) {
                $oeuvre->update(['statut' => 'vendue']);
            }

            return $commande;
        });

        if ($resultat === null) {
            return response()->json([
                'message' => 'Cet article vient d\'être vendue. Elle n\'est plus disponible.',
            ], 409);
        }

        $this->prevenirLAdministration($resultat);

        return response()->json($resultat->load('oeuvre.photos'), 201);
    }

    /**
     * Annuler sa propre commande, tant que rien n'est parti.
     *
     * L'annulation **remet l'article en vente** : une pièce immobilisée par une
     * commande abandonnée est une pièce invendable.
     */
    public function annuler(Request $request, Commande $commande): JsonResponse
    {
        $this->exigerBoutiqueOuverte();
        $this->exigerAcces($request, $commande);

        if (in_array($commande->statut, ['expediee', 'livree'], true)) {
            return response()->json([
                'message' => 'Cette commande est déjà partie. Contactez-nous pour organiser un retour.',
            ], 409);
        }

        if ($commande->statut_paiement === 'reussi') {
            return response()->json([
                'message' => 'Cette commande est réglée. Contactez-nous : le remboursement se traite avec nous.',
            ], 409);
        }

        $this->libererEtAnnuler($commande);

        return response()->json($commande->fresh()->load('oeuvre'));
    }

    /* ══ Côté administration ══════════════════════════════════════ */

    public function indexAdmin(Request $request): JsonResponse
    {
        $request->validate([
            'statut'   => 'sometimes|nullable|in:'.implode(',', array_keys(Commande::STATUTS)),
            'par_page' => 'sometimes|integer|min:5|max:100',
        ]);

        return response()->json(
            Commande::query()
                ->with(['oeuvre.photos', 'client:id,name,email'])
                ->when($request->filled('statut'), fn ($q) => $q->where('statut', $request->input('statut')))
                ->latest()
                ->paginate($request->integer('par_page', 20))
        );
    }

    /**
     * Faire avancer une commande.
     *
     * Livrer une commande payable à la livraison la solde : c'est le moment où
     * l'argent change de mains, et il n'y en a pas d'autre.
     */
    public function avancer(Request $request, Commande $commande): JsonResponse
    {
        $donnees = $request->validate([
            'statut' => 'required|in:'.implode(',', array_keys(Commande::STATUTS)),
        ]);

        $avant = $commande->statut;

        if ($donnees['statut'] === 'annulee') {
            $this->libererEtAnnuler($commande);
        } else {
            $commande->update(array_filter([
                'statut'      => $donnees['statut'],
                'expediee_le' => $donnees['statut'] === 'expediee' ? now() : null,
                'livree_le'   => $donnees['statut'] === 'livree' ? now() : null,
                'statut_paiement' => $donnees['statut'] === 'livree' && $commande->mode_paiement === 'livraison'
                    ? 'reussi'
                    : null,
                'paye_le' => $donnees['statut'] === 'livree' && $commande->mode_paiement === 'livraison'
                    ? now()
                    : null,
            ], fn ($v) => $v !== null));
        }

        JournalAdmin::consigner(
            $request->user(),
            'commande.statut',
            $commande,
            $commande->oeuvre_titre,
            ['statut_avant' => $avant, 'statut_apres' => $commande->fresh()->statut],
            $request->ip(),
        );

        $this->prevenirLAcheteur($commande->fresh());

        return response()->json($commande->fresh()->load('oeuvre.photos', 'client:id,name,email'));
    }

    /* ══ Interne ══════════════════════════════════════════════════ */

    private function exigerAcces(Request $request, Commande $commande): void
    {
        $moi = $request->user();

        if ($moi->role !== 'admin' && $commande->user_id !== $moi->id) {
            abort(403, 'Cette commande n\'est pas la vôtre.');
        }
    }

    /** Annuler et remettre l'article en vente, d'un seul geste. */
    private function libererEtAnnuler(Commande $commande): void
    {
        DB::transaction(function () use ($commande) {
            $commande->update(['statut' => 'annulee']);

            // L'exemplaire retourne au stock : une commande abandonnée ne doit
            // pas immobiliser un article pour toujours.
            $oeuvre = Oeuvre::whereKey($commande->oeuvre_id)->lockForUpdate()->first();
            if (! $oeuvre) {
                return;
            }

            $oeuvre->increment('stock');

            // Et il redevient achetable, sauf si l'administrateur l'avait
            // volontairement retiré en brouillon entre-temps.
            if ($oeuvre->fresh()->statut === 'vendue') {
                $oeuvre->update(['statut' => 'publiee']);
            }
        });
    }

    private function prevenirLAdministration(Commande $commande): void
    {
        foreach (\App\Models\User::where('role', 'admin')->get() as $admin) {
            $this->push->versUtilisateur($admin, [
                'titre'  => 'Nouvelle commande',
                'corps'  => $commande->oeuvre_titre.' — '
                            .number_format($commande->montant_total, 0, ',', ' ').' FCFA',
                'url'    => '/admin/commandes',
                'groupe' => "commande-{$commande->id}",
            ]);
        }
    }

    private function prevenirLAcheteur(Commande $commande): void
    {
        if (! $commande->client) {
            return;
        }

        $message = match ($commande->statut) {
            'expediee' => 'Votre article est en route.',
            'livree'   => 'Votre article a été livrée. Merci !',
            'annulee'  => 'Votre commande a été annulée.',
            default    => null,
        };

        if ($message === null) {
            return;
        }

        $this->push->versUtilisateur($commande->client, [
            'titre'  => $commande->oeuvre_titre,
            'corps'  => $message,
            'url'    => '/boutique/commandes',
            'groupe' => "commande-{$commande->id}",
        ]);
    }

    /**
     * Lance le règlement en ligne d'une commande.
     *
     * Aucune commission n'est calculée : PasseTemps est le vendeur, la totalité
     * lui revient. C'est toute la différence avec le paiement d'une réservation.
     */
    public function payer(Request $request, Commande $commande): JsonResponse
    {
        $this->exigerBoutiqueOuverte();
        $this->exigerAcces($request, $commande);

        if (! config('paiement.actif')) {
            return response()->json(['message' => 'Le paiement en ligne n\'est pas ouvert.'], 503);
        }

        if (! $commande->attendUnReglement()) {
            return response()->json(['message' => 'Cette commande n\'attend aucun règlement.'], 409);
        }

        $donnees = $request->validate([
            'methode'   => 'required|in:wave,orange_money',
            'telephone' => 'required|string|max:30',
        ]);

        $minimum = (int) config('paiement.montant_minimum');
        if ($commande->montant_total < $minimum) {
            return response()->json([
                'message' => "Le paiement en ligne accepte {$minimum} FCFA au minimum.",
            ], 422);
        }

        try {
            $facture = $this->paydunya->creerFacture(
                montant: $commande->montant_total,
                description: "Œuvre « {$commande->oeuvre_titre} » — {$commande->oeuvre_artiste}",
                articles: [
                    'item_0' => [
                        'name'        => $commande->oeuvre_titre,
                        'quantity'    => 1,
                        'unit_price'  => (string) $commande->montant_oeuvre,
                        'total_price' => (string) $commande->montant_oeuvre,
                        'description' => $commande->oeuvre_artiste,
                    ],
                    'item_1' => [
                        'name'        => 'Livraison',
                        'quantity'    => 1,
                        'unit_price'  => (string) $commande->frais_livraison,
                        'total_price' => (string) $commande->frais_livraison,
                        'description' => $commande->ville,
                    ],
                ],
                donneesPersonnalisees: [
                    'commande_id' => (string) $commande->id,
                    'reference'   => $commande->reference,
                ],
                urlRetour: rtrim((string) config('app.frontend_url'), '/')
                    ."/boutique/commandes/{$commande->id}",
            );

            $commande->update(['token_paydunya' => $facture['token'], 'statut_paiement' => 'en_attente']);

            $resultat = $donnees['methode'] === 'wave'
                ? $this->paydunya->payerAvecWave($facture['token'], $request->user()->name, $request->user()->email, $donnees['telephone'])
                : $this->paydunya->payerAvecOrangeMoney($facture['token'], $request->user()->name, $request->user()->email, $donnees['telephone']);

            $lien = $resultat['url'] ?? $resultat['url_application'] ?? null;

            if (! $lien) {
                throw new \RuntimeException('PayDunya a accepté le paiement sans renvoyer de lien à ouvrir.');
            }

            $commande->update([
                'url_paiement'    => $lien,
                'url_application' => $resultat['url_application'] ?? $lien,
            ]);

            return response()->json([
                'reference'       => $commande->reference,
                'montant'         => $commande->montant_total,
                'url'             => $resultat['url'] ?? null,
                'url_application' => $resultat['url_application'] ?? null,
                'url_page'        => $resultat['url_page'] ?? null,
                'repli'           => $resultat['repli'] ?? false,
            ]);
        } catch (\Throwable $e) {
            Log::error('Paiement de commande échoué', [
                'commande' => $commande->id,
                'erreur'   => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Le paiement n\'a pas pu être lancé. Réessayez dans un instant.',
            ], 502);
        }
    }

    /**
     * L'état réel du règlement, relu chez le prestataire.
     *
     * La notification n'a jamais fait foi, ici pas davantage : le statut vient
     * de l'API, interrogée avec nos clés.
     */
    public function statut(Request $request, Commande $commande): JsonResponse
    {
        $this->exigerBoutiqueOuverte();
        $this->exigerAcces($request, $commande);

        if ($commande->token_paydunya && $commande->statut_paiement === 'en_attente') {
            $verifie = $this->paydunya->statutFacture($commande->token_paydunya);

            if ($verifie !== null) {
                $this->inscrireLeReglement($commande, $verifie);
            }
        }

        return response()->json([
            'statut'          => $commande->fresh()->statut,
            'statut_paiement' => $commande->fresh()->statut_paiement,
            'montant'         => $commande->montant_total,
        ]);
    }

    /** @param array{statut: string, montant: mixed, brut: array} $verifie */
    private function inscrireLeReglement(Commande $commande, array $verifie): void
    {
        $statut = match ($verifie['statut']) {
            'completed' => 'reussi',
            'cancelled', 'failed' => 'echoue',
            default => 'en_attente',
        };

        if ($statut === 'en_attente') {
            return;
        }

        // Le montant reçu doit être celui attendu. Un écart signale une facture
        // qui n'est pas la nôtre, ou trafiquée : on ne solde rien.
        if ($statut === 'reussi' && (int) round((float) ($verifie['montant'] ?? 0)) !== $commande->montant_total) {
            Log::warning('Montant de commande incohérent', [
                'commande' => $commande->id,
                'attendu'  => $commande->montant_total,
                'recu'     => $verifie['montant'] ?? null,
            ]);

            return;
        }

        $commande->update([
            'statut_paiement'     => $statut,
            'paye_le'             => $statut === 'reussi' ? now() : null,
            'reponse_prestataire' => $verifie['brut'],
            'statut'              => $statut === 'reussi' ? 'confirmee' : $commande->statut,
        ]);
    }
}
