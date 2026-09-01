<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Reservation extends Model
{
    protected $fillable = [
        'user_id', 'logement_id', 'tarif_id',
        'date_debut', 'date_fin', 'nb_personnes', 'montant_total', 'statut',
        'annulation_demandee_le', 'annulation_motif',
    ];

    protected function casts(): array
    {
        return [
            'date_debut' => 'date',
            'date_fin' => 'date',
            'montant_total' => 'decimal:2',
            'annulation_demandee_le' => 'datetime',
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

    /** La réservation tient lieu de conversation entre le client et le propriétaire. */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('created_at');
    }

    /** Ce qui a été rendu au client sur cette réservation, s'il y a lieu. */
    public function remboursements(): HasMany
    {
        return $this->hasMany(Remboursement::class);
    }

    public function paiement(): HasOne
    {
        return $this->hasOne(Paiement::class);
    }
}
