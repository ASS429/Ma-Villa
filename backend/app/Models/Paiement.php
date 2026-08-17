<?php

namespace App\Models;

use App\Services\Commission;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Paiement extends Model
{
    protected $fillable = [
        'reservation_id', 'methode', 'montant', 'statut', 'reference',
        'commission', 'montant_proprietaire', 'taux_commission',
        'token_paydunya', 'url_paiement', 'reponse_prestataire', 'paye_le',
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
