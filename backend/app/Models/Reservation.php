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

    /**
     * Les coordonnées d'un client sans compte ne se lisent que par `client()`,
     * pour que `revelerLesCoordonnees()` s'applique à lui comme aux autres.
     */
    protected $hidden = ['client_nom', 'client_telephone', 'client_email'];

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

    /**
     * Ce que l'exploitant doit trancher : une annulation demandée par le
     * client, ou un paiement arrivé sur une réservation déjà annulée — dans
     * ce cas l'argent est encaissé et doit être rendu.
     */
    public function scopeAttendUneDecisionDeRemboursement(Builder $query): Builder
    {
        return $query->whereNotNull('annulation_demandee_le')
            ->where(fn (Builder $q) => $q->where('statut', '!=', 'annulee')
                ->orWhereHas('paiement', fn (Builder $p) => $p->where('statut', 'reussi')));
    }

    /**
     * Le client d'un devis réglé hors du site n'a pas forcément de compte : on ne lui en
     * crée pas à son insu. Il garde alors un nom et un numéro, pour que le propriétaire
     * et l'équipe le lisent comme les autres. Ce modèle n'est pas enregistré
     * (`exists` est faux) : pas d'e-mail de compte, pas de notification, pas de messagerie.
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withDefault(
            fn (User $client, Reservation $reservation) => $client->forceFill([
                'name'  => $reservation->client_nom ?: 'Client sans compte',
                'email' => $reservation->client_email,
                'phone' => $reservation->client_telephone,
            ])
        );
    }

    /** Le devis qui a donné lieu à cette réservation, quand elle vient d'un règlement. */
    public function devis(): HasOne
    {
        return $this->hasOne(Devis::class);
    }

    /** L'argent reçu hors du site sur ce séjour. */
    public function reglements(): HasMany
    {
        return $this->hasMany(Reglement::class);
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
