<?php

namespace App\Models;

use App\Services\Commission;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Paiement extends Model
{
    protected $fillable = [
        'reservation_id', 'methode', 'montant', 'statut', 'reference',
        'commission', 'montant_proprietaire', 'taux_commission',
        'token_paydunya', 'url_paiement', 'url_application', 'reponse_prestataire', 'paye_le',
    ];

    protected function casts(): array
    {
        return [
            'montant'              => 'decimal:2',
            'commission'           => 'decimal:2',
            'montant_proprietaire' => 'decimal:2',
            'taux_commission'      => 'decimal:4',
            'reponse_prestataire'  => 'array',
            'paye_le'              => 'datetime',
        ];
    }

    /**
     * Les clés du prestataire n'ont rien à faire dans une réponse d'API, et la
     * réponse brute peut contenir des données du payeur.
     *
     * `token_paydunya` est un identifiant de facture chez le prestataire : qui
     * le détient peut agir sur la transaction. Le front n'en a jamais besoin —
     * il reçoit l'URL de paiement directement à l'initiation.
     */
    protected $hidden = ['reponse_prestataire', 'token_paydunya'];

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    /**
     * Le versement qui a soldé la part du propriétaire. Nul tant qu'elle ne
     * lui a pas été versée.
     *
     * `reversement_id` est volontairement absent de `$fillable` : c'est un
     * champ comptable, il ne doit pouvoir être posé que par le code qui
     * enregistre un versement, jamais par une requête entrante.
     */
    public function reversement(): BelongsTo
    {
        return $this->belongsTo(Reversement::class);
    }

    /* ── Ce qu'on doit, et à qui ─────────────────────────────────── */

    /** Argent réellement encaissé. Le reste n'existe pas comptablement. */
    public function scopeAbouti(Builder $query): Builder
    {
        return $query->where('statut', 'reussi');
    }

    public function scopePourProprietaire(Builder $query, int $userId): Builder
    {
        return $query->whereHas(
            'reservation.logement.villa',
            fn (Builder $q) => $q->where('user_id', $userId)
        );
    }

    /**
     * Ce qui est **exigible** : encaissé, pas encore reversé, et séjour
     * terminé.
     *
     * La dernière condition est le point à ne pas perdre. Un séjour payé mais
     * pas encore commencé peut être annulé : verser d'avance, c'est devoir
     * réclamer ensuite un remboursement à un propriétaire qui a déjà dépensé
     * l'argent. C'est aussi la lecture que les textes juridiques retiennent —
     * le reversement intervient après la fin du séjour.
     */
    public function scopeExigible(Builder $query): Builder
    {
        return $query->abouti()
            ->whereNull('reversement_id')
            ->whereHas('reservation', fn (Builder $q) => $q
                ->where('statut', '!=', 'annulee')
                ->whereDate('date_fin', '<=', now()->toDateString()));
    }

    /** Encaissé et acquis au propriétaire, mais le séjour n'est pas fini. */
    public function scopeAVenir(Builder $query): Builder
    {
        return $query->abouti()
            ->whereNull('reversement_id')
            ->whereHas('reservation', fn (Builder $q) => $q
                ->where('statut', '!=', 'annulee')
                ->whereDate('date_fin', '>', now()->toDateString()));
    }

    /**
     * Fige la répartition au moment du paiement.
     *
     * Les parts sont enregistrées, pas recalculées à la lecture : un changement
     * de barème ne doit jamais réécrire l'histoire comptable des réservations
     * déjà réglées.
     */
    public function appliquerRepartition(Commission $repartition): void
    {
        $this->fill([
            'montant'              => $repartition->montantClient,
            'commission'           => $repartition->commission,
            'montant_proprietaire' => $repartition->montantProprietaire,
            'taux_commission'      => $repartition->taux,
        ]);
    }

    public function estRegle(): bool
    {
        return $this->statut === 'reussi';
    }
}
