<?php

namespace App\Services;

use App\Exceptions\EncaissementRefuse;
use App\Models\Devis;
use App\Models\Logement;
use App\Models\Paiement;
use App\Models\Reglement;
use App\Models\Remboursement;
use App\Models\Reservation;
use App\Models\Tarif;
use App\Models\User;
use App\Notifications\ReservationAnnuleeParLEquipe;
use App\Notifications\ReservationConfirmeeParLEquipe;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * L'argent reçu hors du site : Wave sur le numéro de PasseTemps, espèces, virement.
 *
 * C'est PasseTemps qui reçoit l'argent du client : il détient donc celui du propriétaire, et
 * le lui doit. Trois choses en découlent, et c'est pourquoi rien n'est tenu à part :
 *
 *   — **les dates se bloquent au premier règlement.** Un devis ne bloque rien : sans cela,
 *     on pourrait encaisser un séjour, puis le revendre à un autre ;
 *   — **le paiement du dossier s'alimente comme un paiement du site** (`Paiement`), avec la
 *     même commission : le reversement, les transmissions aux associés et le remboursement
 *     fonctionnent tels quels, et l'argent n'est compté qu'une fois ;
 *   — **un acompte ne déclenche rien.** La part du propriétaire ne devient exigible qu'une
 *     fois le dossier soldé (`Paiement::$solde`) : un versement n'est lié qu'une fois à un
 *     paiement, et un solde reçu après coup serait resté dû sans que rien ne le dise.
 *     Si le client ne paiera jamais le reste, `clore()` arrête le dossier à ce qui a été reçu.
 *
 * Le registre (`Reglement`) garde chaque somme reçue, avec son reçu. Une erreur s'annule avec
 * un motif, tant que l'argent n'est pas reparti ; le numéro reste pris.
 */
final class Encaissement
{
    /** Ce qu'il manque au devis pour qu'on sache quel séjour bloquer et à qui reverser. */
    public static function manques(Devis $devis): array
    {
        $manques = [];

        if (! $devis->villa_id) {
            $manques[] = 'l’annonce';
        }
        if (! $devis->logement_id) {
            $manques[] = 'le logement';
        }
        if (! $devis->tarif_id) {
            $manques[] = 'la formule';
        }
        if (! $devis->date_arrivee || ! $devis->date_depart) {
            $manques[] = 'les dates du séjour';
        }
        if ((int) $devis->total <= 0) {
            $manques[] = 'un montant';
        }

        return $manques;
    }

    /** @param array<string, mixed> $d montant, moyen, recu_le, reference, payeur_telephone, note, confirmer */
    public static function enregistrer(Devis $devis, array $d, User $auteur): Reglement
    {
        for ($essai = 0; ; $essai++) {
            try {
                [$reglement, $premier] = DB::transaction(fn () => self::ecrire($devis->id, $d, $auteur));

                break;
            } catch (UniqueConstraintViolationException $e) {
                // Deux règlements simultanés, le même numéro : on recommence toute la transaction.
                if ($essai >= 4) {
                    throw $e;
                }
            }
        }

        self::prevenir($reglement, $premier);

        return $reglement;
    }

    /** @return array{0: Reglement, 1: bool} */
    private static function ecrire(int $devisId, array $d, User $auteur): array
    {
        $devis = Devis::whereKey($devisId)->lockForUpdate()->firstOrFail();

        if ($manques = self::manques($devis)) {
            throw new EncaissementRefuse('Avant d’encaisser, ce devis doit indiquer '.implode(', ', $manques).' : sans cela, on ne sait ni quel séjour bloquer, ni à qui reverser.');
        }

        $reservation = $devis->reservation_id
            ? Reservation::whereKey($devis->reservation_id)->lockForUpdate()->first()
            : null;

        if ($reservation?->statut === 'annulee') {
            throw new EncaissementRefuse('La réservation de ce devis est annulée : établissez un nouveau devis.', 409);
        }
        if ($reservation?->annulation_demandee_le) {
            throw new EncaissementRefuse('Une annulation attend d’être tranchée sur ce dossier : traitez-la d’abord dans « Remboursements ».', 409);
        }

        $total = $reservation ? (int) round((float) $reservation->montant_total) : (int) $devis->total;
        $deja = (int) Reglement::where('devis_id', $devis->id)->valide()->sum('montant');
        $solde = $total - $deja;
        $montant = (int) $d['montant'];

        if ($solde <= 0) {
            throw new EncaissementRefuse('Ce devis est déjà entièrement réglé.', 409);
        }
        if ($montant > $solde) {
            throw new EncaissementRefuse('Le montant dépasse ce qui reste à payer : '.self::fcfa($solde).'.');
        }

        self::refuserLesDoublons($devis, $d, $montant);

        $premier = ! $reservation;
        $reservation ??= self::bloquerLesDates($devis);

        $annee = (int) now()->format('Y');
        $dernier = Reglement::where('annee', $annee)->orderByDesc('rang')->lockForUpdate()->value('rang');
        $rang = $dernier ? $dernier + 1 : 1;

        $reglement = new Reglement([
            'moyen'            => $d['moyen'],
            'reference'        => filled($d['reference'] ?? null) ? trim($d['reference']) : null,
            // Le numéro d'un devis peut être plus long que celui qu'on garde d'un payeur.
            'payeur_telephone' => filled($d['payeur_telephone'] ?? null)
                ? $d['payeur_telephone']
                : (filled($devis->client_telephone) ? mb_substr($devis->client_telephone, 0, 30) : null),
            'recu_le'          => $d['recu_le'],
            'note'             => $d['note'] ?? null,
        ]);
        $reglement->forceFill([
            'devis_id'       => $devis->id,
            'reservation_id' => $reservation->id,
            'villa_id'       => $devis->villa_id,
            'annee'          => $annee,
            'rang'           => $rang,
            'numero'         => Reglement::numero($annee, $rang),
            'cle'            => Str::random(40),
            'montant'        => $montant,
            'client_nom'     => $devis->client_nom,
            'devis_numero'   => $devis->numero,
            'langue'         => $devis->langue ?? 'fr',
            'statut'         => 'valide',
            'cree_par'       => $auteur->id,
            'createur_nom'   => $auteur->name,
        ])->save();

        $devis->reservation_id = $reservation->id;
        $devis->statut = 'accepte';
        $devis->suivi_le ??= now();
        $devis->save();

        self::actualiser($reservation);

        return [$reglement, $premier];
    }

    /**
     * Une référence est unique : la même transaction Wave ne s'enregistre pas deux fois. Sans
     * référence (espèces), un règlement identique le même jour demande une confirmation : deux
     * personnes peuvent noter la même somme, mais un client peut aussi payer deux fois pareil.
     */
    private static function refuserLesDoublons(Devis $devis, array $d, int $montant): void
    {
        if (filled($d['reference'] ?? null)) {
            $meme = Reglement::valide()->where('reference', trim($d['reference']))->where('moyen', $d['moyen'])->first();
            if ($meme) {
                throw new EncaissementRefuse("Cette référence est déjà enregistrée, sur le reçu {$meme->numero}.", 409);
            }
        }

        if (empty($d['confirmer'])) {
            $jumeau = Reglement::valide()->where('devis_id', $devis->id)->where('montant', $montant)
                ->where('moyen', $d['moyen'])->whereDate('recu_le', $d['recu_le'])->first();
            if ($jumeau) {
                throw new EncaissementRefuse("Un règlement identique existe déjà ce jour-là : {$jumeau->numero}. Est-ce bien une seconde somme ?", 409, ['doublon' => $jumeau->numero]);
            }
        }
    }

    /** Le séjour devient une réservation confirmée : le calendrier, la recherche et le propriétaire le voient. */
    private static function bloquerLesDates(Devis $devis): Reservation
    {
        $logement = Logement::whereKey($devis->logement_id)->lockForUpdate()->first();
        $tarif = Tarif::find($devis->tarif_id);

        if (! $logement || $logement->villa_id !== $devis->villa_id || ! $tarif || $tarif->logement_id !== $logement->id) {
            throw new EncaissementRefuse('Le logement ou la formule de ce devis ne correspond plus à l’annonce choisie : vérifiez-les.');
        }

        $debut = $devis->date_arrivee->toDateString();
        $fin = $devis->date_depart->toDateString();

        $pris = Reservation::where('logement_id', $logement->id)->bloquante()->chevauchant($debut, $fin)->exists()
            || $logement->disponibilites()->where('disponible', false)
                ->where('date_debut', '<=', $fin)->where('date_fin', '>=', $debut)->exists();

        if ($pris) {
            throw new EncaissementRefuse('Ces dates sont déjà prises sur ce logement : aucun règlement n’a été enregistré. Changez les dates ou le logement du devis, ou rendez l’argent au client.', 409);
        }

        $reservation = new Reservation([
            'logement_id'   => $logement->id,
            'tarif_id'      => $tarif->id,
            'date_debut'    => $debut,
            'date_fin'      => $fin,
            'nb_personnes'  => max(1, (int) $devis->personnes),
            'montant_total' => (int) $devis->total,
            'statut'        => 'confirmee',
        ]);
        // Hors de `$fillable` : une requête ne pose pas l'identité d'un client.
        $reservation->forceFill([
            'user_id'          => null,
            'client_nom'       => $devis->client_nom,
            'client_telephone' => $devis->client_telephone,
            'client_email'     => $devis->client_email,
        ])->save();

        return $reservation;
    }

    /**
     * Le paiement du dossier, tel que le voient reversement, transmission et remboursement.
     *
     * La commission se calcule sur **le total du séjour** puis au prorata de ce qui est reçu :
     * le barème va par tranches, et l'appliquer à un acompte donnerait une part différente.
     * Arrondie à l'inférieur : à francs égaux, le doute profite au propriétaire, comme au site.
     * Soldé, le dossier retombe exactement sur `Commission::pour()`.
     */
    private static function actualiser(Reservation $reservation): void
    {
        $reservation->loadMissing('logement.villa');
        $villa = $reservation->logement->villa;

        $recus = Reglement::where('reservation_id', $reservation->id)->valide()->orderBy('recu_le')->orderBy('id')->get();
        $recu = (int) $recus->sum('montant');
        $paiement = Paiement::where('reservation_id', $reservation->id)->lockForUpdate()->first();

        if ($recu === 0) {
            $paiement?->delete();

            return;
        }

        $paiement ??= new Paiement(['reservation_id' => $reservation->id]);
        // Figés au premier règlement : à qui part l'argent, et combien, ne changent pas en
        // cours de dossier, même si l'annonce change entre l'acompte et le solde.
        $circuit = $paiement->exists ? $paiement->circuit : $villa->circuit;
        $majoration = $paiement->exists
            ? $paiement->majoration_figee
            : ($circuit === 'associe' ? $villa->majoration : null);
        $total = (int) round((float) $reservation->montant_total);

        $repartition = Commission::pour($total, $majoration);
        $commission = (int) floor($repartition->commission * $recu / max(1, $total));

        $paiement->fill([
            'methode'          => 'hors_ligne',
            'statut'           => 'reussi',
            'reference'        => $recus->first()->numero,
            'telephone_payeur' => $recus->last()->payeur_telephone,
            'paye_le'          => Carbon::parse($recus->max('recu_le'))->setTimeFrom(now()),
        ]);
        $paiement->appliquerRepartition(new Commission($recu, $repartition->taux, $commission, $recu - $commission), $circuit);
        $paiement->forceFill([
            'hors_ligne'       => true,
            'solde'            => max(0, $total - $recu),
            'majoration_figee' => $majoration,
        ])->save();
    }

    /**
     * Annuler un règlement enregistré par erreur. Impossible une fois l'argent reparti : la part
     * versée au propriétaire ou aux associés, ou rendue au client, ne reviendrait pas toute seule.
     * Le dernier règlement annulé rend les dates : le dossier revient à ce qu'il était avant.
     */
    public static function annuler(Reglement $reglement, string $motif, User $auteur): void
    {
        $libere = DB::transaction(function () use ($reglement, $motif, $auteur) {
            $r = Reglement::whereKey($reglement->id)->lockForUpdate()->firstOrFail();

            if ($r->statut !== 'valide') {
                throw new EncaissementRefuse('Ce règlement est déjà annulé.', 409);
            }

            $reservation = Reservation::whereKey($r->reservation_id)->lockForUpdate()->first();
            $paiement = Paiement::where('reservation_id', $r->reservation_id)->first();

            if ($paiement?->reversement_id) {
                throw new EncaissementRefuse('La part du propriétaire a déjà été versée sur ce dossier : ce règlement ne s’annule plus.', 409);
            }
            if ($paiement?->transmis_le) {
                throw new EncaissementRefuse('Cet argent a déjà été transmis aux associés : ce règlement ne s’annule plus.', 409);
            }
            if (Remboursement::where('reservation_id', $r->reservation_id)->exists()) {
                throw new EncaissementRefuse('Un remboursement est enregistré sur ce dossier : ce règlement ne s’annule plus.', 409);
            }

            $r->forceFill([
                'statut'         => 'annule',
                'annule_le'      => now(),
                'annule_motif'   => $motif,
                'annule_par_nom' => $auteur->name,
            ])->save();

            if (! $reservation) {
                return null;
            }

            self::actualiser($reservation);

            if (Reglement::where('reservation_id', $reservation->id)->valide()->exists()) {
                return null;
            }

            $reservation->forceFill(['statut' => 'annulee', 'annulation_motif' => 'Règlement annulé : '.$motif])->save();
            Devis::where('reservation_id', $reservation->id)->update(['reservation_id' => null, 'statut' => 'emis']);

            return $reservation;
        });

        if ($libere) {
            $libere->loadMissing('logement.villa.proprietaire');

            // Il a reçu un courrier disant ces dates prises : le démenti doit lui arriver pareil.
            try {
                $libere->logement->villa->proprietaire?->notify(new ReservationAnnuleeParLEquipe($libere));
            } catch (\Throwable $e) {
                Log::error('Courrier au propriétaire non envoyé', ['reservation' => $libere->id, 'erreur' => $e->getMessage()]);
            }

            app(Push::class)->versUtilisateur($libere->logement->villa->proprietaire, [
                'titre'  => 'Réservation annulée',
                'corps'  => $libere->logement->villa->nom.' — les dates sont de nouveau libres',
                'url'    => '/dashboard/reservations',
                'groupe' => "reservation-{$libere->id}",
            ]);
        }
    }

    /**
     * Le client ne paiera pas le reste : le dossier s'arrête à ce qui a été reçu. La commission se
     * recalcule sur ce montant, et la part du propriétaire devient exigible après le séjour.
     */
    public static function clore(Devis $devis, User $auteur): int
    {
        return DB::transaction(function () use ($devis) {
            $reservation = Reservation::whereKey($devis->reservation_id)->lockForUpdate()->first();

            if (! $reservation || $reservation->statut === 'annulee') {
                throw new EncaissementRefuse('Ce devis n’a pas de réservation en cours.', 409);
            }

            $recu = (int) Reglement::where('reservation_id', $reservation->id)->valide()->sum('montant');

            if ($recu <= 0 || $recu >= (int) round((float) $reservation->montant_total)) {
                throw new EncaissementRefuse('Il n’y a pas de solde à clore sur ce dossier.', 409);
            }

            $reservation->update(['montant_total' => $recu]);
            self::actualiser($reservation);

            return $recu;
        });
    }

    /**
     * Le client renonce au séjour. La réservation reste confirmée et les dates restent bloquées
     * jusqu'à la décision : la demande part dans « Remboursements », où le barème propose et où
     * l'équipe tranche, comme pour un client du site.
     */
    public static function signalerUneAnnulation(Devis $devis, string $motif): void
    {
        DB::transaction(function () use ($devis, $motif) {
            $reservation = Reservation::whereKey($devis->reservation_id)->lockForUpdate()->first();

            if (! $reservation || $reservation->statut === 'annulee') {
                throw new EncaissementRefuse('Ce devis n’a pas de réservation en cours.', 409);
            }
            if ($reservation->annulation_demandee_le) {
                throw new EncaissementRefuse('Cette annulation attend déjà d’être tranchée dans « Remboursements ».', 409);
            }

            $reservation->update(['annulation_demandee_le' => now(), 'annulation_motif' => $motif]);
        });
    }

    /**
     * Ce que l'écran d'un devis doit savoir.
     *
     * @return array<string, mixed>
     */
    public static function etat(Devis $devis): array
    {
        $devis->loadMissing('villa');
        $reservation = $devis->reservation_id ? Reservation::with('paiement')->find($devis->reservation_id) : null;
        $reglements = Reglement::where('devis_id', $devis->id)->orderByDesc('recu_le')->orderByDesc('id')->get();

        $total = $reservation && $reservation->statut !== 'annulee'
            ? (int) round((float) $reservation->montant_total)
            : (int) $devis->total;
        $encaisse = (int) $reglements->where('statut', 'valide')->sum('montant');
        $paiement = $reservation?->paiement;
        $circuit = $paiement?->circuit ?? $devis->villa?->circuit;
        $majoration = $paiement ? $paiement->majoration_figee : ($circuit === 'associe' ? $devis->villa?->majoration : null);
        $repartition = $total > 0 && $devis->villa ? Commission::pour($total, $majoration) : null;

        return [
            'total'       => $total,
            'encaisse'    => $encaisse,
            'solde'       => max(0, $total - $encaisse),
            'manques'     => self::manques($devis),
            'moyens'      => Reglement::MOYENS,
            'reglements'  => $reglements,
            'repartition' => $repartition ? [
                'commission'   => $repartition->commission,
                'proprietaire' => $repartition->montantProprietaire,
                'taux'         => $repartition->tauxLisible(),
                'circuit'      => $circuit,
            ] : null,
            'reservation' => $reservation ? [
                'id'                     => $reservation->id,
                'statut'                 => $reservation->statut,
                'annulation_demandee_le' => $reservation->annulation_demandee_le?->toIso8601String(),
            ] : null,
            'reparti'     => (bool) ($paiement?->reversement_id || $paiement?->transmis_le),
            'rembourse'   => $reservation ? (int) Remboursement::where('reservation_id', $reservation->id)->sum('montant') : 0,
        ];
    }

    /** Après la transaction : un service de notification lent ne doit pas tenir la base. */
    private static function prevenir(Reglement $reglement, bool $premier): void
    {
        $reglement->loadMissing('reservation.logement.villa.proprietaire');
        $reservation = $reglement->reservation;
        $villa = $reservation->logement->villa;
        $paiement = Paiement::where('reservation_id', $reservation->id)->first();
        $push = app(Push::class);

        // Le propriétaire doit apprendre tout de suite qu'un séjour est vendu : il prépare la venue.
        if ($premier) {
            try {
                $villa->proprietaire?->notify(new ReservationConfirmeeParLEquipe($reservation));
            } catch (\Throwable $e) {
                // L'argent est enregistré : un courrier qui ne part pas ne doit rien défaire.
                Log::error('Courrier au propriétaire non envoyé', ['reservation' => $reservation->id, 'erreur' => $e->getMessage()]);
            }

            $push->versUtilisateur($villa->proprietaire, [
                'titre'  => 'Réservation confirmée',
                'corps'  => "{$villa->nom} — du {$reservation->date_debut->format('d/m')} au {$reservation->date_fin->format('d/m')}",
                'url'    => '/dashboard/reservations',
                'groupe' => "reservation-{$reservation->id}",
            ]);
        }

        if ($paiement?->circuit === 'associe' && (float) $paiement->solde <= 0) {
            foreach (User::where('role', 'admin')->get() as $admin) {
                $push->versUtilisateur($admin, [
                    'titre'  => 'À transmettre aux associés',
                    'corps'  => $villa->nom.' — '.self::fcfa($paiement->aTransmettre()),
                    'url'    => '/admin/reservations',
                    'groupe' => "transmission-{$paiement->id}",
                ]);
            }
        }
    }

    private static function fcfa(int $montant): string
    {
        return number_format($montant, 0, ',', "\u{00A0}")."\u{00A0}FCFA";
    }
}
