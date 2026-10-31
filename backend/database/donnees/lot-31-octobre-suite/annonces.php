<?php

/*
|--------------------------------------------------------------------------
| Suite du lot du 31 octobre 2026 : trois hébergements de Jule
|--------------------------------------------------------------------------
|
| Mis de côté au premier import, précisés par l'exploitant le même jour :
|
| - la villa de Ngor : les deux séries de photos sont la même maison, avant
|   et après sa rénovation. Les photos retenues sont celles d'après : la
|   maison telle qu'on la louera ;
| - les deux appartements de Ngor ont cinq chambres chacun ;
| - l'appartement des Almadies n'existe qu'en photos au filigrane de
|   l'agence ALTIS, avec qui Jule travaille. Le filigrane reste : c'est la
|   marque de l'agence sur ses propres photos.
|
| La villa 5 chambres attend toujours sa ville.
|
| Mêmes règles que le premier lot (`../lot-31-octobre/annonces.php`).
|
*/

return [

    'proprietaires' => [
        'jule' => [
            'empreinte' => '5c8089fad01061570d74b4cba87e052bbc1b65b8bede6d5929e46a00a74d6d3b',
            'attente'   => ['email' => 'jule@passetemps.sn', 'nom' => 'Jule'],
        ],
    ],

    'annonces' => [

        [
            'proprietaire' => 'jule',
            'nom' => 'Villa 6 chambres rénovée avec piscine · Ngor',
            'adresse' => 'Ngor Diarama',
            'ville' => 'Dakar',
            'quartier' => 'Ngor',
            'description' => <<<TEXTE
                Villa entièrement meublée et rénovée à Ngor Diarama, sur trois niveaux, avec piscine et jardin.

                • 6 chambres
                • 2 salons et une salle à manger
                • Cuisine équipée
                • Climatisation
                • Piscine, jardin et terrasses
                TEXTE,
            'photos' => [
                ['villa-6-chambres-ngor-1.jpg', 'La villa'],
                ['villa-6-chambres-ngor-2.jpg', 'La piscine'],
                ['villa-6-chambres-ngor-3.jpg', 'Le salon'],
                ['villa-6-chambres-ngor-4.jpg', 'La salle à manger et la cuisine'],
                ['villa-6-chambres-ngor-5.jpg', 'Une chambre'],
            ],
            'logements' => [
                ['nom' => 'Villa entière · 6 chambres', 'type' => 'villa_entiere', 'capacite' => 12, 'clim' => true,
                    'tarifs' => [['prix' => 250000]]],
            ],
        ],

        [
            'proprietaire' => 'jule',
            'nom' => 'Appartements 5 chambres vue mer · Ngor',
            'adresse' => 'Ngor, près des Almadies',
            'ville' => 'Dakar',
            'quartier' => 'Ngor',
            'description' => <<<TEXTE
                Deux appartements meublés sur le même palier, au 5e étage d'un immeuble de Ngor, près des Almadies, avec vue sur la mer.

                • 5 chambres par appartement, salon et salle à manger
                • Cuisine équipée
                • Immeuble avec ascenseur et gardiennage
                • Internet, eau et ménage compris
                TEXTE,
            'photos' => [
                ['appartements-5-chambres-ngor-1.jpg', 'Le salon'],
                ['appartements-5-chambres-ngor-2.jpg', 'La salle à manger et le balcon'],
                ['appartements-5-chambres-ngor-3.jpg', 'Une chambre'],
                ['appartements-5-chambres-ngor-4.jpg', 'Une autre chambre'],
                ['appartements-5-chambres-ngor-5.jpg', 'La cuisine'],
            ],
            'logements' => [
                ['nom' => 'Appartement A · 5 chambres', 'type' => 'appartement', 'capacite' => 10, 'tarifs' => [['prix' => 100000]]],
                ['nom' => 'Appartement B · 5 chambres', 'type' => 'appartement', 'capacite' => 10, 'tarifs' => [['prix' => 100000]]],
            ],
        ],

        [
            'proprietaire' => 'jule',
            'nom' => 'Appartement d\'exception 3 chambres · Almadies',
            'adresse' => 'Almadies, face aux bureaux de la Banque mondiale',
            'ville' => 'Dakar',
            'quartier' => 'Almadies',
            'description' => <<<TEXTE
                Appartement meublé de 230 m² au 4e étage d'une résidence de standing des Almadies, face aux bureaux de la Banque mondiale. Grands volumes, mobilier soigné, entièrement équipé.

                • Vaste salon et salle à manger lumineux
                • 3 grandes chambres, 3 salles de bain et des toilettes visiteurs
                • Cuisine fermée et équipée, avec îlot central
                • Climatisation
                • Résidence avec piscine, salle de sport, ascenseur et groupe électrogène
                • Place de parking, cave et sécurité 24 h/24

                Se loue au mois, charges en plus.
                TEXTE,
            'photos' => [
                ['appartement-exception-almadies-1.jpg', 'Le salon'],
                ['appartement-exception-almadies-2.jpg', 'La salle à manger'],
                ['appartement-exception-almadies-3.jpg', 'La chambre principale'],
                ['appartement-exception-almadies-4.jpg', 'La cuisine'],
                ['appartement-exception-almadies-5.jpg', 'Une chambre'],
            ],
            'logements' => [
                ['nom' => 'Appartement · 3 chambres', 'type' => 'appartement', 'capacite' => 6, 'nuits_minimum' => 30, 'clim' => true,
                    'tarifs' => [['prix' => 66667, 'mois' => 2000000]]],
            ],
        ],

    ],
];
