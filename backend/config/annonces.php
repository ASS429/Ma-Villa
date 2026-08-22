<?php

/*
|--------------------------------------------------------------------------
| Annonces
|--------------------------------------------------------------------------
*/

return [

    /*
    | Nombre de photos qu'une annonce peut détenir, au total.
    |
    | Un plafond et non un plancher : sur ce marché la data est payée au
    | volume, et chaque photo est payée deux fois — à l'envoi par le
    | propriétaire, au chargement par chaque visiteur qui ouvre la fiche.
    |
    | Le compte porte sur ce que l'annonce détient déjà, pas sur la taille de
    | l'envoi : sans cela, cinq envois d'une photo franchiraient le plafond
    | sans jamais le dépasser en une fois.
    */
    'photos_max' => (int) env('ANNONCE_PHOTOS_MAX', 5),
];
