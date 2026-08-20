<?php

/*
|--------------------------------------------------------------------------
| Boutique d'œuvres d'art
|--------------------------------------------------------------------------
|
| Second métier de la plateforme, décidé le 12 août 2026. Ma Villa est le seul
| vendeur : pas de commission, pas de reversement, l'argent d'une vente lui
| revient entièrement.
|
*/

return [

    /*
    | Tant que ceci vaut false, la boutique n'apparaît nulle part et ses routes
    | publiques répondent 404. Même principe que `paiement.actif` : ouvrir un
    | métier est une décision, pas un effet de bord de déploiement.
    */
    'actif' => (bool) env('BOUTIQUE_ACTIVE', false),

    /*
    |--------------------------------------------------------------------------
    | Zones de livraison
    |--------------------------------------------------------------------------
    |
    | Le client doit connaître son total **avant** de payer : c'est la moitié
    | de la confiance sur un premier achat. Des frais annoncés après coup sont
    | la première cause d'abandon sur une boutique qui démarre.
    |
    | Les frais sont en FCFA, entiers — la devise n'a pas de subdivision.
    |
    | ⚠️ La clé est enregistrée sur la commande, mais le **montant est figé** au
    | moment de commander. Relever un tarif ne doit jamais réécrire une vente
    | déjà passée.
    |
    */
    'livraison' => [

        'zones' => [
            'dakar' => [
                'nom'   => 'Dakar et banlieue',
                'frais' => (int) env('LIVRAISON_DAKAR', 2000),
                'delai' => '24 à 48 heures',
            ],
            'regions' => [
                'nom'   => 'Autres régions du Sénégal',
                'frais' => (int) env('LIVRAISON_REGIONS', 5000),
                'delai' => '3 à 5 jours',
            ],
            'retrait' => [
                'nom'   => 'Retrait sur place',
                'frais' => 0,
                'delai' => 'Sur rendez-vous',
            ],
        ],
    ],

    /*
    | Le paiement à la livraison a été décidé le 12 août, à côté de Wave et
    | Orange Money. Réglable : c'est un risque commercial — une commande
    | refusée à la porte laisse une œuvre immobilisée et un transport perdu.
    */
    'paiement_a_la_livraison' => (bool) env('BOUTIQUE_PAIEMENT_LIVRAISON', true),
];
