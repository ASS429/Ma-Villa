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
    | Deux taux, appliqués **par tranches** comme un barème d'imposition : les
    | premiers francs au taux réduit, ceux au-delà du seuil au taux élevé.
    |
    | En taux pleins, le barème créait une marche : à 49 000 le propriétaire
    | touchait 44 100, à 51 000 il touchait 40 800. Il perdait à vendre plus cher.
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
            'nom'         => env('PAYDUNYA_BOUTIQUE_NOM', 'PasseTemps'),
            'description' => 'Location de villas et logements de vacances au Sénégal',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Reversement au propriétaire
    |--------------------------------------------------------------------------
    |
    | La plateforme encaisse tout, puis reverse. Le versement peut se faire de
    | deux façons, et les deux coexistent volontairement :
    |
    |   — à la main : un virement fait hors de l'application, simplement
    |     enregistré ici. C'est le seul chemin tant que PayDunya n'a pas ouvert
    |     l'option « Paiement Et Redistribution » (PER / déboursement) sur le
    |     compte marchand, ce qui est le cas au 19 août 2026 ;
    |
    |   — automatique : l'API de déboursement envoie l'argent sur le Wave ou
    |     l'Orange Money du propriétaire.
    |
    | `automatique` reste donc à false par défaut. Le jour de l'activation, une
    | variable d'environnement suffit : rien à redéployer, et la sonde
    | `/admin/diagnostic/reversement` dit si PayDunya accepte l'initiation.
    |
    */
    'reversement' => [

        'automatique' => (bool) env('REVERSEMENT_AUTOMATIQUE', false),

        /*
        | Correspondance entre nos moyens et les `withdraw_mode` de PayDunya.
        |
        | `virement` et `especes` n'y figurent pas : ils n'existent que hors
        | ligne, et c'est justement pourquoi ils restent proposés à la main.
        */
        'modes' => [
            'wave'         => 'wave-senegal',
            'orange_money' => 'orange-money-senegal',
            'free_money'   => 'free-money-senegal',
        ],

        /*
        | Un déboursement se refuse sous le plancher du prestataire, comme un
        | encaissement. Le tenir ici évite de partir pour rien.
        */
        'montant_minimum' => (int) env('REVERSEMENT_MONTANT_MINIMUM', 200),

        /*
        | Indicatif à retirer du numéro : PayDunya attend `771111111`, sans
        | indicatif ni espaces, alors que les comptes portent « +221 77 … ».
        */
        'indicatif' => env('REVERSEMENT_INDICATIF', '221'),
    ],

];
