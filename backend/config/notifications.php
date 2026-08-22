<?php

/*
|--------------------------------------------------------------------------
| Préférences de notification
|--------------------------------------------------------------------------
|
| Planche 38 : trois canaux, cinq sujets, une grille.
|
| Une liste d'interrupteurs « Recevoir les SMS » ne dit pas **de quoi**. Ici on
| lit une ligne et on sait où arrive quoi.
|
| Le barème vit ici plutôt qu'en base : ce sont des libellés et des règles, pas
| des données. Le front rend la grille à partir de cette structure, si bien
| qu'ajouter un sujet ne demande pas de redéployer l'interface.
|
*/

return [

    /*
    | L'ordre est celui des colonnes, et il est délibéré : « Appli » d'abord,
    | parce que c'est le canal qui ne coûte rien à celui qui reçoit et qui ne
    | tombe pas — le SMS est à 6 % d'échec.
    */
    'canaux' => [
        'appli' => ['nom' => 'Appli'],
        'sms'   => ['nom' => 'SMS'],
        'mail'  => ['nom' => 'Mail'],
    ],

    /*
    | Chaque sujet dit ce qu'il envoie, sur quels canaux il est actif par
    | défaut, et lesquels ne peuvent pas être coupés.
    |
    | `verrouille` porte une raison **écrite**. Une case grisée avec sa raison
    | vaut mieux qu'une case absente : le propriétaire comprend la règle au lieu
    | de la subir, et n'a pas à se demander si l'interface a un défaut.
    */
    'sujets' => [
        'reservation_demande' => [
            'nom'        => 'Demandes de réservation',
            'detail'     => 'Un client demande à réserver un de vos logements.',
            'defaut'     => ['appli' => true, 'sms' => true, 'mail' => true],
            'verrouille' => ['appli'],
            'raison'     => 'Rater une demande annule la réservation au bout de 24 h.',
        ],

        'reservation_suite' => [
            'nom'    => 'Confirmations et paiements',
            'detail' => 'Une réservation est confirmée, réglée, ou annulée.',
            'defaut' => ['appli' => true, 'sms' => false, 'mail' => true],
        ],

        'messages' => [
            'nom'    => 'Messages',
            'detail' => 'Un client ou un propriétaire vous écrit.',
            'defaut' => ['appli' => true, 'sms' => false, 'mail' => false],
        ],

        'versements' => [
            'nom'        => 'Versements',
            'detail'     => 'Votre part vous est versée, ou un versement est retardé.',
            'defaut'     => ['appli' => true, 'sms' => true, 'mail' => true],
            'verrouille' => ['appli'],
            'raison'     => 'C\'est le seul moment où de l\'argent change de mains.',
        ],

        'conseils' => [
            'nom'    => 'Conseils et nouveautés',
            'detail' => 'Comment mieux louer, et ce qui change sur la plateforme.',
            /*
             | Décoché partout, et le SMS surtout : sur un forfait payé au
             | volume, un message marketing non demandé coûte de l'argent à
             | celui qui le reçoit.
             */
            'defaut' => ['appli' => false, 'sms' => false, 'mail' => false],
        ],
    ],

    /*
    | À 6 % d'échec relevé par la sonde, bâtir une notification critique sur le
    | seul SMS revient à ne pas la faire partir une fois sur seize. Tout sujet
    | verrouillé sur « appli » double donc le SMS, et l'interface le dit en
    | toutes lettres plutôt que de laisser le propriétaire le découvrir.
    */
    'phrase_sms' => 'Le SMS peut mettre quelques minutes. Le message dans l\'application arrive toujours.',
];
