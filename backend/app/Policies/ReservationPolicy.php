<?php

namespace App\Policies;

use App\Models\Reservation;
use App\Models\User;

class ReservationPolicy
{
    /**
     * Une réservation ne concerne que trois personnes : le client qui l'a
     * faite, le propriétaire du logement, et l'admin.
     */
    public function view(User $user, Reservation $reservation): bool
    {
        return $this->estPartiePrenante($user, $reservation);
    }

    public function update(User $user, Reservation $reservation): bool
    {
        return $this->estPartiePrenante($user, $reservation);
    }

    private function estPartiePrenante(User $user, Reservation $reservation): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        // Le client, sur sa propre réservation.
        if ($user->id === $reservation->user_id) {
            return true;
        }

        // Le propriétaire de la villa dont dépend le logement réservé.
        return $user->id === $reservation->logement->villa->user_id;
    }
}
