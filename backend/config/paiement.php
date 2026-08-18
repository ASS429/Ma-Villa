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
    | Montant minimum encaissable
    |--------------------------------------------------------------------------
    |
    | PayDunya refuse toute facture en dessous de 200 FCFA — « Invalid Total
    | Amount. Minimum checkout amount is 200 FCFA. » Sans garde ici, une petite
    | réservation partait quand même et revenait en 502 : un échec qui accuse la
    | plateforme alors que le montant seul est en cause.
    |
    */
    'montant_minimum' => (int) env('PAIEMENT_MONTANT_MINIMUM', 200),

    /*
    |--------------------------------------------------------------------------
    | Repli sur la page de paiement PayDunya
    |--------------------------------------------------------------------------
    |
    | SoftPay ouvre Wave ou Orange Money sans étape intermédiaire — c'est le
    | parcours qu'on veut. Mais il demande une activation côté PayDunya et
    | n'est pas servi partout : il répond alors sans rien, et la facture créée
    | juste avant reste parfaitement payable sur la page du prestataire.
    |
    | Basculer sur cette page plutôt que d'échouer coûte une étape au client.
    | Renoncer coûte la vente. On replie donc par défaut, en le journalisant :
    | un repli permanent signale un SoftPay à faire activer, pas un état normal.
    |
    */
    'repli_checkout' => (bool) env('PAIEMENT_REPLI_CHECKOUT', true),

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
        // Le mode est porté par les clés, pas par l'URL : il se choisit à la
        // création de l'application chez PayDunya, qui délivre alors des clés
        // « test_… » ou « live_… ». Ce réglage ne sert donc qu'à repérer une
        // incohérence entre ce qu'on déclare et ce qu'on utilise réellement.
        'mode'         => env('PAYDUNYA_MODE', 'test'), // test | live

        // Une seule base pour tous les endpoints, celle que documente PayDunya.
        // `sandbox-api/v1` existe mais ne sert pas SoftPay : on y récolte des
        // 404, donc des refus sans message. Laissé réglable pour n'avoir jamais
        // à redéployer si PayDunya déplace ses URL.
        'base_url'     => env('PAYDUNYA_BASE_URL'),
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
