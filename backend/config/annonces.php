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

    /*
    |--------------------------------------------------------------------------
    | Repères de prix à l'étape tarifaire
    |--------------------------------------------------------------------------
    |
    | Nombre minimal d'annonces comparables avant d'oser afficher une
    | fourchette locale au propriétaire.
    |
    | ⚠️ En dessous, on n'affiche **rien** — surtout pas une médiane
    | nationale. Entre Saly et la Casamance les prix n'ont aucun rapport :
    | une moyenne des deux serait fausse dans les deux sens, et un
    | propriétaire qui fixe son prix dessus le regrettera. Ne rien dire est
    | plus honnête que dire approximativement.
    |
    */

    'reperes_prix_minimum' => (int) env('ANNONCE_REPERES_PRIX_MINIMUM', 10),
];
