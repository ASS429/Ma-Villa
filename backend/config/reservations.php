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

    /*
    |--------------------------------------------------------------------------
    | Barème d'annulation
    |--------------------------------------------------------------------------
    |
    | Ce que le client récupère quand il se désiste, selon le nombre de jours
    | qui restent avant l'arrivée. Le premier palier dont le seuil est atteint
    | s'applique ; les paliers se lisent du plus lointain au plus proche.
    |
    | ⚠️ Ce barème ne s'applique **qu'au client qui se désiste**. Quand
    | l'annulation vient de la plateforme ou du propriétaire — logement
    | indisponible, erreur de notre côté — le remboursement est intégral,
    | commission comprise : le client n'a pas à payer notre défaillance.
    |
    | Le barème **propose**, il ne décide pas : l'écran affiche la part qui en
    | découle, et l'exploitant peut la corriger. Un cas particulier existe
    | toujours, et une règle qu'on ne peut pas contourner se contourne hors du
    | logiciel — donc sans trace.
    |
    | ⚠️ À faire valider par le juriste avant d'être annoncé aux clients. Un
    | barème publié est un engagement.
    |
    */
    'bareme_annulation' => [
        ['jours_avant' => 7, 'part' => 1.0],   // une semaine ou plus : intégral
        ['jours_avant' => 2, 'part' => 0.5],   // de 2 à 6 jours : la moitié
        ['jours_avant' => 0, 'part' => 0.0],   // moins de 48 h : rien
    ],

];
