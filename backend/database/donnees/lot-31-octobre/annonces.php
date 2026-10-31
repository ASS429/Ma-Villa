<?php

/*
|--------------------------------------------------------------------------
| Neuf hébergements transmis par l'exploitant le 31 octobre 2026
|--------------------------------------------------------------------------
|
| Trois propriétaires. Deux sont désignés par leur adresse, dont seule
| l'empreinte SHA-256 figure ici (dépôt public) ; le troisième par son nom
| seul. Un compte introuvable est remplacé par un compte à son nom, sans
| boîte aux lettres, comme pour Clé d'Or : l'annonce paraît tout de suite,
| et la console la rattache au vrai compte le jour où il existe.
|
| Circuit des associés, comme Virage : `prix`, `semaine` et `mois` sont les
| prix **du propriétaire**, majorés à l'import. Aucun prix n'est écrit dans
| les descriptions, pour qu'elles ne contredisent jamais la grille.
|
| Ce qui se loue à la semaine ou au mois porte une durée minimale et un prix
| de nuit égal à la période divisée par ses nuits : le prix de période
| s'applique alors de lui-même (`PrixSejour`).
|
| Mis de côté puis précisés le même jour : la villa de Ngor, les deux
| appartements de Ngor et l'appartement d'exception des Almadies (voir
| `../lot-31-octobre-suite`). La villa 5 chambres attend toujours sa ville.
|
*/

return [

    'proprietaires' => [
        'jule' => [
            'empreinte' => '5c8089fad01061570d74b4cba87e052bbc1b65b8bede6d5929e46a00a74d6d3b',
            'attente'   => ['email' => 'jule@passetemps.sn', 'nom' => 'Jule'],
        ],
        'modou-sene' => [
            'empreinte' => null,
            'attente'   => ['email' => 'modou-sene@passetemps.sn', 'nom' => 'Modou Sene'],
        ],
        'moussa' => [
            'empreinte' => '747c0fe6c4a7315590c6ef5bf09faad213741a6a089d3ff5d5940de6b1f4104e',
            'attente'   => ['email' => 'moussa@passetemps.sn', 'nom' => 'Moussa'],
        ],
    ],

    'annonces' => [

        [
            'proprietaire' => 'jule',
            'nom' => 'Maison 3 chambres avec piscine · Saly',
            'adresse' => 'Saly',
            'ville' => 'Saly',
            'quartier' => null,
            'description' => <<<TEXTE
                Maison de 100 m² à Saly, avec piscine privée de 4 × 9 m au milieu d'un jardin tropical. Un cadre calme pour se reposer en famille ou entre amis.

                • 3 chambres et 2 salles de bain
                • Salon et cuisine équipée
                • Terrasse couverte, jardin et piscine privée

                Se loue à la semaine, de novembre à mai.
                TEXTE,
            'photos' => [
                ['maison-piscine-saly-1.jpg', 'La piscine'],
                ['maison-piscine-saly-2.jpg', 'La maison et le jardin'],
                ['maison-piscine-saly-3.jpg', 'Le salon'],
                ['maison-piscine-saly-4.jpg', 'Une chambre'],
                ['maison-piscine-saly-5.jpg', 'La cuisine'],
            ],
            'logements' => [
                ['nom' => 'Maison entière · 3 chambres', 'type' => 'villa_entiere', 'capacite' => 6, 'nuits_minimum' => 7,
                    'tarifs' => [['prix' => 64286, 'semaine' => 450000]]],
            ],
        ],

        [
            'proprietaire' => 'jule',
            'nom' => 'Villa meublée avec piscine · Ngaparou',
            'adresse' => 'Ngaparou, quartier résidentiel',
            'ville' => 'Ngaparou',
            'quartier' => null,
            'description' => <<<TEXTE
                Villa moderne et meublée sur un terrain de 300 m², dans un quartier calme et résidentiel de Ngaparou.

                • Rez-de-chaussée : deux chambres avec salle de bain, grand séjour lumineux avec cuisine américaine, cuisine africaine indépendante, toilettes visiteurs, chambre de gardien
                • Étage : séjour avec cuisine américaine, une chambre avec salle de bain, petit séjour qui peut servir de bureau, terrasse de 70 à 80 m²
                • Piscine de 8 × 4 m qui fonctionne aux panneaux solaires, grande terrasse carrelée
                • Réserve d'eau, puits et réseau SEN'EAU ; stationnement pour un véhicule

                Se loue au mois.
                TEXTE,
            'photos' => [
                ['villa-moderne-ngaparou-1.jpg', 'La villa et sa piscine'],
                ['villa-moderne-ngaparou-2.jpg', 'Le séjour'],
                ['villa-moderne-ngaparou-3.jpg', 'Une chambre'],
                ['villa-moderne-ngaparou-4.jpg', 'La cuisine'],
                ['villa-moderne-ngaparou-5.jpg', 'La cour et la piscine'],
            ],
            'logements' => [
                ['nom' => 'Villa entière · 3 chambres', 'type' => 'villa_entiere', 'capacite' => 6, 'nuits_minimum' => 30,
                    'tarifs' => [['prix' => 26667, 'mois' => 800000]]],
            ],
        ],

        [
            'proprietaire' => 'jule',
            'nom' => 'Chambres en appartement · Ouest Foire',
            'adresse' => 'Ouest Foire, à côté de la gendarmerie',
            'ville' => 'Dakar',
            'quartier' => 'Ouest Foire',
            'description' => <<<TEXTE
                Deux appartements meublés identiques à Ouest Foire, à côté de la gendarmerie. Chacun a deux chambres et un salon : on y loue la chambre.

                • 2 chambres par appartement
                • Salon et coin repas, partagés entre les deux chambres de l'appartement
                TEXTE,
            'photos' => [
                ['appartements-ouest-foire-1.jpg', 'Le salon du premier appartement'],
                ['appartements-ouest-foire-2.jpg', 'Le salon du second appartement'],
                ['appartements-ouest-foire-3.jpg', 'Une chambre'],
                ['appartements-ouest-foire-4.jpg', 'Une autre chambre'],
                ['appartements-ouest-foire-5.jpg', 'Le coin repas'],
            ],
            'logements' => [
                ['nom' => 'Appartement A · chambre 1', 'type' => 'chambre', 'capacite' => 2, 'tarifs' => [['prix' => 35000]]],
                ['nom' => 'Appartement A · chambre 2', 'type' => 'chambre', 'capacite' => 2, 'tarifs' => [['prix' => 35000]]],
                ['nom' => 'Appartement B · chambre 1', 'type' => 'chambre', 'capacite' => 2, 'tarifs' => [['prix' => 35000]]],
                ['nom' => 'Appartement B · chambre 2', 'type' => 'chambre', 'capacite' => 2, 'tarifs' => [['prix' => 35000]]],
            ],
        ],

        [
            'proprietaire' => 'modou-sene',
            'nom' => 'Réceptif de 10 logements avec piscine · Ngaparou',
            'adresse' => 'Ngaparou',
            'ville' => 'Ngaparou',
            'quartier' => null,
            'description' => <<<TEXTE
                Dix logements autour d'une grande piscine à Ngaparou, pour accueillir jusqu'à vingt personnes : un groupe, une délégation ou une grande famille.

                • 10 logements de deux personnes, chacun avec salon, chambre et salle d'eau
                • Climatisation
                • Piscine et jardin
                • Repas possibles sur place

                Le prix s'entend pour deux personnes et par nuit, avec ou sans les repas. L'eau et l'électricité sont à la charge des clients.
                TEXTE,
            'photos' => [
                ['receptif-ngaparou-1.jpg', 'La piscine le soir'],
                ['receptif-ngaparou-2.jpg', 'La piscine et les logements'],
                ['receptif-ngaparou-3.jpg', 'Vue d\'ensemble'],
                ['receptif-ngaparou-4.jpg', 'Le salon d\'un logement'],
                ['receptif-ngaparou-5.jpg', 'Une chambre'],
            ],
            'logements' => array_map(fn (int $n) => [
                'nom' => "Logement {$n}", 'type' => 'residence', 'capacite' => 2, 'clim' => true,
                // 60 000 F par personne sans les repas, 75 000 F avec.
                'tarifs' => [['prix' => 120000], ['prix' => 150000, 'repas' => true]],
            ], range(1, 10)),
        ],

        [
            'proprietaire' => 'moussa',
            'nom' => 'Villa blanche 7 chambres avec piscine · Virage',
            'adresse' => 'Virage, Almadies',
            'ville' => 'Dakar',
            'quartier' => 'Yoff',
            'description' => <<<TEXTE
                Grande villa contemporaine sur trois niveaux à Virage, près des Almadies, autour d'une piscine bordée de palmiers.

                • Rez-de-chaussée : 2 chambres avec salle de bain, grand salon, salle de sport, cuisine et terrasses
                • 1er étage : 5 chambres avec salle de bain et terrasses
                • 2e étage : grand salon, terrasses et toilettes visiteurs
                • Piscine

                L'électricité est à la charge des clients, en plus du prix.
                TEXTE,
            'photos' => [
                ['villa-blanche-virage-1.jpg', 'La villa et la piscine'],
                ['villa-blanche-virage-2.jpg', 'La piscine et les palmiers'],
                ['villa-blanche-virage-3.jpg', 'Le salon'],
                ['villa-blanche-virage-4.jpg', 'Une chambre'],
                ['villa-blanche-virage-5.jpg', 'Une salle de bain'],
            ],
            'logements' => [
                ['nom' => 'Villa entière · 7 chambres', 'type' => 'villa_entiere', 'capacite' => 14, 'clim' => true,
                    'tarifs' => [['prix' => 450000]]],
            ],
        ],

        [
            'proprietaire' => 'moussa',
            'nom' => 'Villa 4 chambres avec piscine et jardin · Ngaparou',
            'adresse' => 'Ngaparou',
            'ville' => 'Ngaparou',
            'quartier' => null,
            'description' => <<<TEXTE
                Villa à Ngaparou, avec piscine et espace vert.

                • 4 chambres et salon
                • Piscine, pelouse et coin ombragé
                • Garage
                TEXTE,
            'photos' => [
                ['villa-4-chambres-ngaparou-1.jpg', 'La piscine'],
                ['villa-4-chambres-ngaparou-2.jpg', 'Le jardin'],
                ['villa-4-chambres-ngaparou-3.jpg', 'Le séjour'],
                ['villa-4-chambres-ngaparou-4.jpg', 'L\'entrée'],
                ['villa-4-chambres-ngaparou-5.jpg', 'Une chambre'],
            ],
            'logements' => [
                ['nom' => 'Villa entière · 4 chambres', 'type' => 'villa_entiere', 'capacite' => 8,
                    'tarifs' => [['prix' => 120000]]],
            ],
        ],

        [
            'proprietaire' => 'moussa',
            'nom' => 'Appartement 3 chambres face à l\'océan · Almadies',
            'adresse' => 'Almadies',
            'ville' => 'Dakar',
            'quartier' => 'Almadies',
            'description' => <<<TEXTE
                Appartement meublé aux Almadies, avec vue sur la mer depuis le séjour et le balcon.

                • 3 chambres, salon et salle à manger
                • Cuisine équipée
                • Balcon face à l'océan
                • Climatisation

                L'électricité est à la charge des clients, en plus du prix.
                TEXTE,
            'photos' => [
                ['appartement-vue-mer-almadies-1.jpg', 'Le séjour face à la mer'],
                ['appartement-vue-mer-almadies-2.jpg', 'Le balcon'],
                ['appartement-vue-mer-almadies-3.jpg', 'Le séjour et la salle à manger'],
                ['appartement-vue-mer-almadies-4.jpg', 'Une chambre'],
                ['appartement-vue-mer-almadies-5.jpg', 'La cuisine'],
            ],
            'logements' => [
                ['nom' => 'Appartement · 3 chambres', 'type' => 'appartement', 'capacite' => 6, 'clim' => true,
                    'tarifs' => [['prix' => 80000]]],
            ],
        ],

        [
            'proprietaire' => 'moussa',
            'nom' => 'Appartement 3 chambres avec conciergerie · Virage',
            'adresse' => 'Virage',
            'ville' => 'Dakar',
            'quartier' => 'Yoff',
            'description' => <<<TEXTE
                Appartement entièrement aménagé à Virage, dans une résidence avec vue sur la mer.

                • 3 chambres, grand salon et salle à manger
                • Climatisation
                • Résidence avec ascenseur, piscine et salle de sport
                • Parking et concierge
                TEXTE,
            'photos' => [
                ['appartement-3-chambres-virage-1.jpg', 'Le salon'],
                ['appartement-3-chambres-virage-2.jpg', 'La salle à manger'],
                ['appartement-3-chambres-virage-3.jpg', 'Une chambre'],
                ['appartement-3-chambres-virage-4.jpg', 'Une autre chambre'],
                ['appartement-3-chambres-virage-5.jpg', 'La troisième chambre'],
            ],
            'logements' => [
                ['nom' => 'Appartement · 3 chambres', 'type' => 'appartement', 'capacite' => 6, 'clim' => true,
                    'tarifs' => [['prix' => 175000]]],
            ],
        ],

        [
            'proprietaire' => 'moussa',
            'nom' => 'Appartement meublé 2 chambres · Ngaparou',
            'adresse' => 'Ngaparou, près de Couleur Sénégal',
            'ville' => 'Ngaparou',
            'quartier' => null,
            'description' => <<<TEXTE
                Appartement entièrement meublé à Ngaparou, près de Couleur Sénégal, dans un cadre calme.

                • 2 chambres, 2 salons et 2 toilettes
                • Cuisine équipée
                • Climatisation, wifi et chauffe-eau
                TEXTE,
            'photos' => [
                ['appartement-meuble-ngaparou-1.jpg', 'Le salon'],
                ['appartement-meuble-ngaparou-2.jpg', 'Une chambre'],
                ['appartement-meuble-ngaparou-3.jpg', 'La salle à manger'],
                ['appartement-meuble-ngaparou-4.jpg', 'Le second salon'],
                ['appartement-meuble-ngaparou-5.jpg', 'La cuisine'],
            ],
            'logements' => [
                ['nom' => 'Appartement · 2 chambres', 'type' => 'appartement', 'capacite' => 4, 'clim' => true,
                    'tarifs' => [['prix' => 45000]]],
            ],
        ],

    ],
];
