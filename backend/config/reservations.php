<?php

/*
|--------------------------------------------------------------------------
| Réservations
|--------------------------------------------------------------------------
*/

return [

    /*
    | Délai laissé au propriétaire pour répondre à une demande.
    |
    | Passé ce délai, la demande est annulée automatiquement. Une demande qui
    | traîne coûte plus cher qu'un refus : le client attend, ne cherche pas
    | ailleurs, et découvre trop tard qu'il n'a nulle part où dormir. Le
    | propriétaire, lui, voit son délai de réponse affiché sur ses annonces.
    |
    | ⚠️ Aucun remboursement n'est nécessaire, et ce n'est pas un oubli : un
    | paiement abouti **confirme** la réservation (voir PaiementController).
    | Une demande restée « en attente » n'a donc jamais été réglée.
    */
    'delai_reponse_heures' => (int) env('RESERVATION_DELAI_REPONSE', 24),
];
