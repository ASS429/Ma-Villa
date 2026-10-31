<?php

/*
|--------------------------------------------------------------------------
| Fin du lot du 31 octobre 2026 : la villa 5 chambres de Jule, à Saly
|--------------------------------------------------------------------------
|
| Mise de côté au premier import faute de ville, donnée par l'exploitant le
| même jour : « Sa ville c'est Saly ».
|
| L'annonce reçue (réf. GC) donnait un tarif pour un contrat annuel, et
| « le tarif pour 1 mois est de 2 millions de francs CFA ». On publie le
| mois, seul prix connu, et trente nuits au moins — comme l'appartement
| d'exception des Almadies. Cinq photos sur vingt-deux, les plus belles.
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
            'nom' => 'Villa 5 chambres avec piscine et jacuzzi · Saly',
            'adresse' => 'Saly',
            'ville' => 'Saly',
            'quartier' => null,
            'description' => <<<TEXTE
                Grande villa entièrement meublée et équipée, avec jardin, piscine à débordement et jacuzzi.

                • 5 chambres climatisées, 5 salles de bain et des toilettes visiteurs
                • Grande cuisine, et cuisine américaine ouverte sur le salon
                • Buanderie avec machine à laver, débarras
                • Pool house, piscine chauffée par panneaux solaires
                • Garage pour 2 véhicules, chambre de gardien
                • Clôture électrique et caméras de surveillance

                Se loue au mois.
                TEXTE,
            'photos' => [
                ['villa-5-chambres-saly-1.jpg', 'La villa et sa piscine'],
                ['villa-5-chambres-saly-2.jpg', 'La piscine et le jacuzzi'],
                ['villa-5-chambres-saly-3.jpg', 'Le salon'],
                ['villa-5-chambres-saly-4.jpg', 'Une chambre'],
                ['villa-5-chambres-saly-5.jpg', 'La piscine, le soir'],
            ],
            'logements' => [
                ['nom' => 'Villa entière · 5 chambres', 'type' => 'villa_entiere', 'capacite' => 10, 'nuits_minimum' => 30, 'clim' => true,
                    'tarifs' => [['prix' => 66667, 'mois' => 2000000]]],
            ],
        ],

    ],
];
