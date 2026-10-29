<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JournalAdmin;
use App\Models\Paiement;
use App\Models\Reservation;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Ce que la console doit tenir pendant les JOJ.
 *
 * Les demandes de réservation : sur un compte que personne n'ouvre (Clé d'Or,
 * tenu par un associé), une demande n'était vue par personne et s'annulait
 * seule au bout du délai. L'admin confirme ou refuse ici, par la même route
 * que le propriétaire, après avoir vérifié avec le gérant.
 *
 * Les transmissions : l'argent du circuit des associés leur est transmis à
 * chaque paiement, à la main chez PayDunya. On enregistre ce qui a été fait,
 * rien ne part d'ici — comme les reversements.
 */
class CircuitAssociesController extends Controller
{
    public function demandes(): JsonResponse
    {
        $delai = (int) config('reservations.delai_reponse_heures');

        $demandes = Reservation::where('statut', 'en_attente')
            ->with([
                'logement:id,villa_id,nom',
                'logement.villa:id,user_id,nom,ville,quartier',
                'logement.villa.proprietaire:id,name',
                'client:id,name',
            ])
            ->orderBy('created_at')
            ->get()
            ->map(fn (Reservation $r) => [
                'id'             => $r->id,
                'villa'          => $r->logement?->villa?->nom,
                'villa_id'       => $r->logement?->villa?->id,
                'lieu'           => collect([$r->logement?->villa?->ville, $r->logement?->villa?->quartier])->filter()->implode(' · '),
                'logement'       => $r->logement?->nom,
                'proprietaire'   => $r->logement?->villa?->proprietaire?->name,
                'client'         => $r->client?->name,
                'date_debut'     => $r->date_debut,
                'date_fin'       => $r->date_fin,
                'nb_personnes'   => $r->nb_personnes,
                'montant_total'  => (int) $r->montant_total,
                'demandee_le'    => $r->created_at?->toIso8601String(),
                'expire_le'      => $r->created_at?->copy()->addHours($delai)->toIso8601String(),
            ]);

        return response()->json(['demandes' => $demandes, 'delai_heures' => $delai]);
    }

    public function transmissions(): JsonResponse
    {
        $ligne = fn (Paiement $p) => [
            'id'                 => $p->id,
            'reservation_id'     => $p->reservation_id,
            'villa'              => $p->reservation?->logement?->villa?->nom,
            'logement'           => $p->reservation?->logement?->nom,
            'proprietaire'       => $p->reservation?->logement?->villa?->proprietaire?->name,
            'client'             => $p->reservation?->client?->name,
            'date_debut'         => $p->reservation?->date_debut,
            'date_fin'           => $p->reservation?->date_fin,
            'methode'            => $p->methode,
            'paye_le'            => $p->paye_le?->toIso8601String(),
            'montant'            => (int) $p->montant,
            'montant_proprietaire' => (int) $p->montant_proprietaire,
            'commission'         => (int) $p->commission,
            'part_passetemps'    => (int) $p->part_passetemps,
            'a_transmettre'      => $p->aTransmettre(),
            'transmis_le'        => $p->transmis_le?->toIso8601String(),
            'transmis_montant'   => $p->transmis_montant !== null ? (int) $p->transmis_montant : null,
            'transmis_reference' => $p->transmis_reference,
            'transmis_par'       => $p->transmis_par,
        ];

        $relations = [
            'reservation:id,logement_id,user_id,date_debut,date_fin,statut',
            'reservation.logement:id,villa_id,nom',
            'reservation.logement.villa:id,user_id,nom',
            'reservation.logement.villa.proprietaire:id,name',
            'reservation.client:id,name',
        ];

        $aTransmettre = Paiement::query()->aTransmettre()->with($relations)->orderBy('paye_le')->get();

        $transmis = Paiement::query()->abouti()->where('circuit', 'associe')
            ->whereNotNull('transmis_le')
            ->with($relations)->latest('transmis_le')->limit(100)->get();

        return response()->json([
            'a_transmettre' => $aTransmettre->map($ligne)->values(),
            'transmis'      => $transmis->map($ligne)->values(),
            'totaux'        => [
                'a_transmettre'   => $aTransmettre->sum(fn (Paiement $p) => $p->aTransmettre()),
                'part_passetemps' => (int) Paiement::query()->abouti()->where('circuit', 'associe')
                    ->whereHas('reservation', fn ($q) => $q->where('statut', '!=', 'annulee'))
                    ->sum('part_passetemps'),
            ],
        ]);
    }

    public function noterTransmission(Request $request, Paiement $paiement): JsonResponse
    {
        $donnees = $request->validate([
            // Ce qui est réellement parti : le montant dû, moins les frais
            // PayDunya que l'exploitant voit au moment du retrait.
            'montant'   => 'required|integer|min:1',
            'reference' => 'nullable|string|max:120',
        ]);

        $resultat = DB::transaction(function () use ($paiement, $donnees, $request) {
            // Verrouillé : deux admins qui notent en même temps la même
            // transmission ne doivent pas l'enregistrer deux fois.
            $p = Paiement::whereKey($paiement->id)->lockForUpdate()->first();

            if (! Paiement::query()->aTransmettre()->whereKey($p->id)->exists()) {
                return ['code' => 409, 'message' => $p->transmis_le
                    ? 'Cette transmission est déjà enregistrée.'
                    : "Ce paiement n'a rien à transmettre aux associés."];
            }

            if ($donnees['montant'] > $p->aTransmettre()) {
                return ['code' => 422, 'message' => 'Le montant dépasse ce qui est dû aux associés ('
                    .number_format($p->aTransmettre(), 0, ',', ' ').' FCFA).'];
            }

            $p->forceFill([
                'transmis_le'        => now(),
                'transmis_montant'   => $donnees['montant'],
                'transmis_reference' => $donnees['reference'] ?? null,
                'transmis_par'       => $request->user()->name,
            ])->save();

            return ['paiement' => $p];
        });

        if (isset($resultat['code'])) {
            return response()->json(['message' => $resultat['message']], $resultat['code']);
        }

        JournalAdmin::consigner(
            $request->user(),
            'associes.transmission',
            $resultat['paiement'],
            "Paiement {$resultat['paiement']->reference}",
            array_filter([
                'montant'   => $donnees['montant'],
                'du'        => $resultat['paiement']->aTransmettre(),
                'reference' => $donnees['reference'] ?? null,
            ]),
            $request->ip(),
        );

        return response()->json(['message' => 'Transmission enregistrée.']);
    }

    /**
     * Rattache toutes les annonces d'un compte à un autre, désigné par son
     * e-mail : Clé d'Or et SEN IMMO s'inscrivent eux-mêmes, et leurs annonces,
     * créées sous un compte d'attente, doivent leur revenir.
     */
    public function transfererAnnonces(Request $request, User $user): JsonResponse
    {
        $donnees = $request->validate(['email' => 'required|email|max:255']);

        $cible = User::whereRaw('lower(email) = ?', [mb_strtolower(trim($donnees['email']))])->first();

        if (! $cible) {
            return response()->json(['message' => "Aucun compte n'est inscrit à cette adresse."], 404);
        }

        if ($cible->id === $user->id) {
            return response()->json(['message' => 'Ce sont déjà ses annonces.'], 422);
        }

        if ($cible->role === 'admin') {
            return response()->json(['message' => "Une annonce n'appartient pas à un compte d'administration."], 422);
        }

        $nombre = DB::transaction(function () use ($user, $cible) {
            $ids = Villa::where('user_id', $user->id)->lockForUpdate()->pluck('id');

            // Un client qui reçoit des annonces devient propriétaire : sans
            // cela, son espace ne les lui montrerait pas.
            if ($ids->isNotEmpty() && $cible->role === 'client') {
                $cible->forceFill(['role' => 'proprietaire'])->save();
            }

            Villa::whereIn('id', $ids)->update(['user_id' => $cible->id]);

            return $ids->count();
        });

        if ($nombre === 0) {
            return response()->json(['message' => "Ce compte n'a aucune annonce."], 422);
        }

        JournalAdmin::consigner(
            $request->user(),
            'villas.transferees',
            $cible,
            $cible->name,
            ['depuis' => $user->name, 'depuis_id' => $user->id, 'annonces' => $nombre],
            $request->ip(),
        );

        return response()->json([
            'message' => $nombre === 1
                ? "L'annonce appartient maintenant à {$cible->name}."
                : "Les {$nombre} annonces appartiennent maintenant à {$cible->name}.",
        ]);
    }
}
