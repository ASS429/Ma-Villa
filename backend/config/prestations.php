<?php

/*
|--------------------------------------------------------------------------
| Services aux voyageurs — transport et repas
|--------------------------------------------------------------------------
|
| Nés pour les familles des athlètes des JOJ Dakar 2026, mais permanents : les
| JOJ ne sont qu'une vitrine posée dessus (`config/joj.php`), qui se retire sans
| les toucher. Décidé le 20 octobre 2026 : on commence par **une demande**,
| confirmée sur WhatsApp — pas de paiement en ligne, pas de réservation ferme.
|
| Deux familles seulement pour ce premier lot. Les sorties guidées attendent que
| le partenaire ait confirmé ses guides, les « pass » que leurs prix soient
| fixés avec les prestataires : une demande qu'on ne sait pas honorer coûte plus
| qu'un service absent.
|
| ── Les prix ──────────────────────────────────────────────────────────
| Des prix **de départ, indicatifs** : les ordres de grandeur du marché relevés
| dans l'offre du partenaire du 19 octobre. Ils ne sont pas encore négociés avec
| chaque prestataire, d'où « à partir de » et la confirmation sur WhatsApp.
| Rien n'est encaissé sur ces montants : ils informent, ils n'engagent pas.
|
| ── Pourquoi ici et pas dans le front ─────────────────────────────────
| C'est le serveur qui valide la prestation demandée et qui la nomme dans la
| console. Une seconde liste côté interface finirait par diverger — trois fois
| déjà, avec les villes et les types de logement.
|
*/

return [

    /*
    | Chaque famille s'ouvre par sa propre variable, comme `BOUTIQUE_ACTIVE` :
    | fermée par défaut, ouverte par décision. Une seule variable pour tout
    | aurait éteint le transport en même temps que les JOJ, alors qu'il doit
    | leur survivre. Fermée, une famille n'existe que pour l'administration,
    | qui la voit en aperçu pour la tester en production.
    */
    'familles' => [
        'transport' => [
            'actif'   => (bool) env('TRANSPORT_ACTIF', false),
            'libelle' => ['fr' => 'Transport', 'en' => 'Transport'],
        ],
        'restauration' => [
            'actif'   => (bool) env('RESTAURATION_ACTIVE', false),
            'libelle' => ['fr' => 'Repas', 'en' => 'Meals'],
        ],
    ],

    /*
    | `vol` : la prestation part de l'aéroport, le formulaire demande le numéro
    | du vol. C'est lui qui permet d'attendre un avion en retard au lieu de
    | facturer une attente.
    */
    'catalogue' => [

        'transfert_aibd' => [
            'famille' => 'transport',
            'prix_a_partir_de' => 25000,
            'vol' => true,
            'libelle' => [
                'fr' => "Transfert depuis l'aéroport AIBD",
                'en' => 'AIBD airport transfer',
            ],
            'unite' => [
                'fr' => 'le trajet, voiture 4 places',
                'en' => 'per trip, 4-seat car',
            ],
            'description' => [
                'fr' => 'Votre chauffeur vous attend à la sortie avec une pancarte à votre nom, même si le vol a du retard.',
                'en' => 'Your driver waits at arrivals with a sign bearing your name, even if your flight is late.',
            ],
        ],

        'trajets_sites' => [
            'famille' => 'transport',
            'prix_a_partir_de' => 5000,
            'vol' => false,
            'libelle' => [
                'fr' => 'Trajets vers les sites des épreuves',
                'en' => 'Rides to the competition venues',
            ],
            'unite' => [
                'fr' => 'par personne et par jour, aller-retour',
                'en' => 'per person per day, return',
            ],
            'description' => [
                'fr' => "Aller-retour entre votre logement et le site, avec dépose au point autorisé le plus proche de l'entrée.",
                'en' => 'Return trip between your accommodation and the venue, dropped at the authorised point nearest the entrance.',
            ],
        ],

        'chauffeur' => [
            'famille' => 'transport',
            'prix_a_partir_de' => 45000,
            'vol' => false,
            'libelle' => [
                'fr' => 'Voiture avec chauffeur',
                'en' => 'Car with driver',
            ],
            'unite' => [
                'fr' => 'la journée, véhicule 7 places',
                'en' => 'per day, 7-seat vehicle',
            ],
            'description' => [
                'fr' => 'Une voiture et un chauffeur pour votre famille seule, à la demi-journée ou à la journée.',
                'en' => 'A car and driver for your family only, by the half-day or the day.',
            ],
        ],

        'petit_dejeuner' => [
            'famille' => 'restauration',
            'prix_a_partir_de' => 2500,
            'vol' => false,
            'libelle' => [
                'fr' => 'Petit-déjeuner au logement',
                'en' => 'Breakfast at your accommodation',
            ],
            'unite' => [
                'fr' => 'par personne',
                'en' => 'per person',
            ],
            'description' => [
                'fr' => 'Pain frais, fruits, café Touba ou thé, servi ou livré chaque matin.',
                'en' => 'Fresh bread, fruit, Touba coffee or tea, served or delivered every morning.',
            ],
        ],

        'panier_repas' => [
            'famille' => 'restauration',
            'prix_a_partir_de' => 3500,
            'vol' => false,
            'libelle' => [
                'fr' => 'Panier repas pour les jours d’épreuve',
                'en' => 'Packed meal for competition days',
            ],
            'unite' => [
                'fr' => 'par personne',
                'en' => 'per person',
            ],
            'description' => [
                'fr' => 'Un repas complet à emporter au stade, prêt dès 8 h.',
                'en' => 'A full meal to take to the stadium, ready from 8 am.',
            ],
        ],

        'table' => [
            'famille' => 'restauration',
            'prix_a_partir_de' => 6000,
            'vol' => false,
            'libelle' => [
                'fr' => 'Table dans un restaurant partenaire',
                'en' => 'Table at a partner restaurant',
            ],
            'unite' => [
                'fr' => 'par personne, menu fixe',
                'en' => 'per person, set menu',
            ],
            'description' => [
                'fr' => 'Un menu fixe près des sites ; halal, végétarien ou sans allergènes sur demande.',
                'en' => 'A set menu near the venues; halal, vegetarian or allergen-free on request.',
            ],
        ],
    ],

    /*
    | Le délai de réponse annoncé sur la page. Au-delà, la demande passe en
    | urgence dans « Ce qui attend » : c'est une promesse publiée.
    */
    'delai_reponse_heures' => 2,

];
