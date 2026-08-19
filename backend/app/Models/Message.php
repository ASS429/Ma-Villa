<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un message échangé sur une réservation.
 *
 * La réservation tient lieu de conversation : elle porte déjà les deux
 * interlocuteurs et la règle d'accès. Voir la migration pour le raisonnement.
 */
class Message extends Model
{
    protected $fillable = ['reservation_id', 'user_id', 'corps', 'lu_le'];

    protected function casts(): array
    {
        return ['lu_le' => 'datetime'];
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    public function auteur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
