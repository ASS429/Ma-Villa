<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Reservation extends Model
{
    protected $fillable = [
        'user_id', 'logement_id', 'tarif_id',
        'date_debut', 'date_fin', 'nb_personnes', 'montant_total', 'statut',
    ];

    protected function casts(): array
    {
        return [
            'date_debut' => 'date',
            'date_fin' => 'date',
            'montant_total' => 'decimal:2',
        ];
    }

    /**
     * Réservations qui occupent tout ou partie de la période demandée.
     * Règle unique, partagée par la création de réservation et la recherche
     * par dates : une villa proposée comme libre doit rester réservable.
     */
    public function scopeChevauchant(Builder $query, string $debut, string $fin): Builder
    {
        return $query->where('date_debut', '<=', $fin)
                     ->where('date_fin', '>=', $debut);
    }

    /** Réservations qui bloquent réellement le calendrier (une annulation libère la date). */
    public function scopeBloquante(Builder $query): Builder
    {
        return $query->where('statut', '!=', 'annulee');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function logement(): BelongsTo
    {
        return $this->belongsTo(Logement::class);
    }

    public function tarif(): BelongsTo
    {
        return $this->belongsTo(Tarif::class);
    }

    public function paiement(): HasOne
    {
        return $this->hasOne(Paiement::class);
    }
}
