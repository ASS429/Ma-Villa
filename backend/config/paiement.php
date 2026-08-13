<?php

/*
|--------------------------------------------------------------------------
| Paiement en ligne
|--------------------------------------------------------------------------
|
| Encaissement par PayDunya (SoftPay), moyens Wave et Orange Money.
|
| Tant que `actif` vaut false, aucun parcours de paiement n'est proposé et
| l'interface indique que le règlement se fait avec le propriétaire. Le
| passage à true est une variable d'environnement, sans redéploiement du
| front — celui-ci lit l'état via /api/configuration.
|
*/

return [

    'actif' => env('PAIEMENT_ACTIF', false),

    'moyens' => [
        ['cle' => 'wave', 'nom' => 'Wave'],
        ['cle' => 'orange_money', 'nom' => 'Orange Money'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Commission
    |--------------------------------------------------------------------------
    |
    | Elle est **prélevée sur ce que paie le client**, jamais ajoutée par-dessus :
    | le montant affiché sur l'annonce est celui que le client règle, et le
    | propriétaire touche la différence. Afficher un prix puis en facturer un
    | autre est le meilleur moyen de perdre la confiance sur un premier achat.
    |
    | Deux taux, selon que la réservation est « grosse » ou « petite ».
    |
    | ⚠️ Le seuil est une valeur par défaut, à confirmer. Il est exprimé en
    | montant plutôt qu'en catégorie : une règle par catégorie devrait être
    | rouverte à chaque nouvelle catégorie (« studio meublé » est déjà attendu),
    | alors qu'un seuil en francs vaut pour toutes, y compris futures.
    |
    */
    'commission' => [
        'taux_eleve'  => (float) env('COMMISSION_TAUX_ELEVE', 0.20),
        'taux_reduit' => (float) env('COMMISSION_TAUX_REDUIT', 0.10),

        // Au-dessus (inclus) : taux élevé. En dessous : taux réduit.
        'seuil' => (int) env('COMMISSION_SEUIL', 50000),
    ],

    /*
    |--------------------------------------------------------------------------
    | PayDunya
    |--------------------------------------------------------------------------
    */
    'paydunya' => [
        'mode'         => env('PAYDUNYA_MODE', 'test'), // test | live
        'cle_maitre'   => env('PAYDUNYA_MASTER_KEY'),
        'cle_privee'   => env('PAYDUNYA_PRIVATE_KEY'),
        'cle_publique' => env('PAYDUNYA_PUBLIC_KEY'),
        'token'        => env('PAYDUNYA_TOKEN'),

        'boutique' => [
            'nom'         => env('PAYDUNYA_BOUTIQUE_NOM', 'Ma Villa'),
            'description' => 'Location de villas et logements de vacances au Sénégal',
        ],
    ],

];
