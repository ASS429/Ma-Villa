<?php

/*
|--------------------------------------------------------------------------
| Neuf logements à Virage (Yoff) et aux Almadies
|--------------------------------------------------------------------------
|
| Transmis par l'exploitant le 29 octobre 2026, pour un propriétaire déjà
| inscrit sur le site, et passés par le gérant hébergement : circuit des
| associés, prix majoré de notre part (voir `config/paiement.php`).
|
| `prix` est le prix **du propriétaire** à la nuit (« la journée ») ; le
| prix affiché est calculé à l'import. Aucun prix n'est écrit dans les
| descriptions, pour qu'elles ne contredisent jamais la grille.
|
| Ce que tous partagent, selon l'exploitant : climatisation, chauffe-eau,
| wifi, Canal+, sécurité 24 h/24, cuisine équipée. Capacité : deux
| personnes par chambre, comme pour Clé d'Or, à faire confirmer.
|
| Précisé par l'exploitant le 30 octobre : AP3 et AP4 sont deux logements
| différents, et l'immeuble d'AP8 a bien piscine et salle de sport
| (`ImportVirage::completer` l'a reporté sur les annonces déjà en ligne).
|
*/

$commun = "Climatisation, chauffe-eau, wifi et Canal+. Sécurité 24 h/24.";

return [

    [
        'nom' => 'Appartement 3 chambres, piscine et salle de sport (A)',
        'adresse' => 'Virage, Yoff',
        'ville' => 'Dakar',
        'quartier' => 'Yoff',
        'description' => <<<TEXTE
            Appartement de 170 m² à Virage, près des Almadies, dans un immeuble avec piscine et salle de sport.

            • 3 chambres, salon et salle à manger
            • Cuisine équipée
            • 2 toilettes intérieures et 1 extérieure
            • {$commun}
            TEXTE,
        'photos' => [
            ['ap1-1.jpg', 'Salon'],
            ['ap1-2.jpg', 'Salle à manger'],
            ['ap1-3.jpg', 'Cuisine équipée'],
            ['ap1-4.jpg', 'Chambre'],
            ['ap1-5.jpg', 'Salle de bain'],
        ],
        'logement' => ['nom' => 'Appartement · 3 chambres', 'type' => 'appartement', 'capacite' => 6, 'prix' => 110000],
    ],

    [
        'nom' => 'Appartement 3 chambres, piscine et salle de sport (B)',
        'adresse' => 'Virage, Yoff',
        'ville' => 'Dakar',
        'quartier' => 'Yoff',
        'description' => <<<TEXTE
            Appartement de 170 m² à Virage, près des Almadies, dans un immeuble avec piscine et salle de sport.

            • 3 chambres, salon et salle à manger
            • Cuisine équipée
            • 2 toilettes intérieures et 1 extérieure
            • {$commun}
            TEXTE,
        'photos' => [
            ['ap2-1.jpg', 'Salon'],
            ['ap2-2.jpg', 'Salle à manger'],
            ['ap2-3.jpg', 'Cuisine équipée'],
            ['ap2-4.jpg', 'Chambre'],
            ['ap2-5.jpg', 'Salle de bain'],
        ],
        'logement' => ['nom' => 'Appartement · 3 chambres', 'type' => 'appartement', 'capacite' => 6, 'prix' => 110000],
    ],

    [
        'nom' => 'Studio meublé · Virage',
        'adresse' => 'Virage, Yoff',
        'ville' => 'Dakar',
        'quartier' => 'Yoff',
        'description' => <<<TEXTE
            Studio meublé à Virage, près des Almadies, pour deux personnes.

            • Coin salon et table à manger
            • Cuisine équipée
            • {$commun}
            TEXTE,
        'photos' => [
            ['studio1-1.jpg', 'Pièce de vie'],
            ['studio1-2.jpg', 'Cuisine équipée'],
            ['studio1-3.jpg', 'Coin salon et table'],
            ['studio1-4.jpg', 'Entrée'],
            ['studio1-5.jpg', 'Salon'],
        ],
        'logement' => ['nom' => 'Studio', 'type' => 'studio', 'capacite' => 2, 'prix' => 35000],
    ],

    [
        'nom' => 'Appartement 3 chambres décoré · Virage',
        'adresse' => 'Virage, Yoff',
        'ville' => 'Dakar',
        'quartier' => 'Yoff',
        'description' => <<<TEXTE
            Appartement décoré à Virage, près des Almadies.

            • 3 chambres, grand salon et salle à manger
            • Cuisine équipée
            • {$commun}
            TEXTE,
        'photos' => [
            ['ap3-1.jpg', 'Salon'],
            ['ap3-2.jpg', 'Salle à manger'],
            ['ap3-3.jpg', 'Chambre'],
            ['ap3-4.jpg', 'Chambre'],
            ['ap3-5.jpg', 'Salle de bain'],
        ],
        'logement' => ['nom' => 'Appartement · 3 chambres', 'type' => 'appartement', 'capacite' => 6, 'prix' => 125000],
    ],

    [
        'nom' => 'Appartement 3 chambres, terrasse vue mer · Virage',
        'adresse' => 'Virage, Yoff',
        'ville' => 'Dakar',
        'quartier' => 'Yoff',
        'description' => <<<TEXTE
            Appartement à Virage, près des Almadies, avec une grande terrasse couverte face à la mer.

            • 3 chambres et salon
            • Terrasse meublée, vue sur l'océan
            • Cuisine équipée
            • {$commun}
            TEXTE,
        'photos' => [
            ['ap4-1.jpg', 'Terrasse face à la mer'],
            ['ap4-2.jpg', 'Chambre'],
            ['ap4-3.jpg', 'Chambre'],
            ['ap4-4.jpg', 'Terrasse meublée'],
            ['ap4-5.jpg', 'Vue sur la mer depuis la terrasse'],
        ],
        'logement' => ['nom' => 'Appartement · 3 chambres', 'type' => 'appartement', 'capacite' => 6, 'prix' => 125000],
    ],

    [
        'nom' => 'Appartement 3 chambres vue mer · Almadies',
        'adresse' => "Derrière l'ambassade des États-Unis, Almadies",
        'ville' => 'Dakar',
        'quartier' => 'Almadies',
        'description' => <<<TEXTE
            Appartement aux Almadies, derrière l'ambassade des États-Unis, avec vue sur la mer.

            • 3 chambres, salon et salle à manger
            • Cuisine équipée
            • {$commun}
            TEXTE,
        'photos' => [
            ['ap5-1.jpg', 'Salon et salle à manger'],
            ['ap5-2.jpg', 'Salon'],
            ['ap5-3.jpg', 'Cuisine équipée'],
            ['ap5-4.jpg', 'Chambre'],
            ['ap5-5.jpg', 'Vue sur la mer'],
        ],
        'logement' => ['nom' => 'Appartement · 3 chambres', 'type' => 'appartement', 'capacite' => 6, 'prix' => 130000],
    ],

    [
        'nom' => 'Appartement 3 chambres avec piscine · Virage (A)',
        'adresse' => 'Virage, Yoff',
        'ville' => 'Dakar',
        'quartier' => 'Yoff',
        'description' => <<<TEXTE
            Appartement à Virage, près des Almadies, dans une résidence avec piscine.

            • 3 chambres et salon
            • Cuisine équipée
            • {$commun}
            TEXTE,
        'photos' => [
            ['ap6-1.jpg', 'Salon'],
            ['ap6-2.jpg', 'Second salon'],
            ['ap6-3.jpg', 'Cuisine équipée'],
            ['ap6-4.jpg', 'Chambre'],
            ['ap6-5.jpg', "Salle d'eau"],
        ],
        'logement' => ['nom' => 'Appartement · 3 chambres', 'type' => 'appartement', 'capacite' => 6, 'prix' => 80000],
    ],

    [
        'nom' => 'Appartement 3 chambres avec piscine · Virage (B)',
        'adresse' => 'Virage, Yoff',
        'ville' => 'Dakar',
        'quartier' => 'Yoff',
        'description' => <<<TEXTE
            Appartement à Virage, près des Almadies, dans une résidence avec piscine.

            • 3 chambres, salon et salle à manger
            • Cuisine équipée
            • {$commun}
            TEXTE,
        'photos' => [
            ['ap7-1.jpg', 'Salon'],
            ['ap7-2.jpg', 'Salle à manger'],
            ['ap7-3.jpg', 'Cuisine équipée'],
            ['ap7-4.jpg', 'Chambre'],
            ['ap7-5.jpg', 'Salle de bain'],
        ],
        'logement' => ['nom' => 'Appartement · 3 chambres', 'type' => 'appartement', 'capacite' => 6, 'prix' => 80000],
    ],

    [
        'nom' => 'Appartement 3 chambres, piscine et salle de sport · Almadies',
        'adresse' => 'Almadies',
        'ville' => 'Dakar',
        'quartier' => 'Almadies',
        'description' => <<<TEXTE
            Appartement aux Almadies, dans un immeuble récent avec piscine et salle de sport.

            • 3 chambres, salon et salle à manger
            • Cuisine équipée
            • {$commun}
            TEXTE,
        'photos' => [
            ['ap8-1.jpg', 'Salon'],
            ['ap8-2.jpg', "Piscine de l'immeuble"],
            ['ap8-3.jpg', 'Cuisine équipée'],
            ['ap8-4.jpg', 'Chambre avec vue sur la mer'],
            ['ap8-5.jpg', 'Salle de sport'],
        ],
        'logement' => ['nom' => 'Appartement · 3 chambres', 'type' => 'appartement', 'capacite' => 6, 'prix' => 100000],
    ],

];
