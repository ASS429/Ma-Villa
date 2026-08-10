<?php

/*
|--------------------------------------------------------------------------
| Paiement en ligne
|--------------------------------------------------------------------------
|
| Wave et Orange Money sont annoncés dans l'interface mais volontairement
| inactifs : la stratégie d'encaissement (agrégateur ou API directes) n'est
| pas arrêtée.
|
| Tant que `actif` vaut false, aucun parcours de paiement n'est proposé et
| l'interface indique clairement que le règlement se fait avec le propriétaire.
| Le passage à true est une simple variable d'environnement, sans
| redéploiement du front — celui-ci lit l'état via /api/configuration.
|
*/

return [

    'actif' => env('PAIEMENT_ACTIF', false),

    /*
     * Moyens annoncés. Servent uniquement à l'affichage tant que `actif` est
     * à false : aucune intégration n'est branchée derrière.
     */
    'moyens' => [
        ['cle' => 'wave', 'nom' => 'Wave'],
        ['cle' => 'orange_money', 'nom' => 'Orange Money'],
    ],

];
