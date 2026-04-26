<?php

namespace App\Policies;

use App\Models\Reservation;
use App\Models\User;

class ReservationPolicy
{
    public function update(User $user, Reservation $reservation): bool
    {
        // Le client peut annuler sa propre réservation
        if ($user->id === $reservation->user_id) {
            return true;
        }

        // Le propriétaire de la villa peut confirmer/refuser
        return $user->id === $reservation->logement->villa->user_id
            || $user->role === 'admin';
    }
}
