<?php

/*
|--------------------------------------------------------------------------
| Les logements meublés de Clé d'Or Immobilier et Services
|--------------------------------------------------------------------------
|
| Repris de leur liste « Biens meublés disponibles — JOJ Dakar 2026 », reçue
| le 20 octobre 2026 par les partenaires qui travaillent avec eux, et intégrée
| à la demande de l'exploitant : ces logements apparaissent sous le nom de
| Clé d'Or, leur propriétaire.
|
| Une résidence à plusieurs logements devient **une** annonce à plusieurs
| logements (SOWDI, Cristallines) — c'est exactement ce que le modèle
| villa → logements sait dire. Le site ne connaît que des tarifs à la nuitée :
| les prix au mois et les prix dégressifs du document sont écrits dans la
| description, mot pour mot.
|
| ⚠️ La capacité n'est pas dans le document : deux personnes par chambre,
| à faire confirmer par Clé d'Or.
|
| Photos : découpées des collages du document. Trois logements n'y avaient
| que des bandes très allongées en plus de leur photo principale ; elles
| sont écartées, floues une fois agrandies.
|
*/

$proposePar = "Proposé par Clé d'Or Immobilier et Services.";

return [

    [
        'nom' => 'F4 meublé · Résidence Sorano',
        'adresse' => 'Boulevard de la République, près du rond-point du ministère de l\'Intérieur',
        'ville' => 'Dakar',
        'quartier' => 'Plateau',
        'description' => <<<TEXTE
            {$proposePar}

            Grand F4 meublé au 4e étage de la Résidence Sorano, au cœur de Dakar-Plateau, à proximité des administrations, des affaires et des principaux axes.

            • 3 chambres avec dressing et salle de bain ; 2 toilettes visiteurs séparées
            • Grand salon, salle à manger, buanderie, chauffe-eau
            • Cuisine entièrement équipée : lave-linge, sèche-linge, réfrigérateur, micro-ondes, 2 cuisinières
            • Groupe électrogène dans l'immeuble : continuité électrique assurée
            • Ascenseur, suppresseur, vigile, éclairage des parties communes

            Tarifs : 200 000 F la nuitée · 3 000 000 F le mois.
            TEXTE,
        'photos' => [
            ['sorano-1.jpg', 'Grand salon et salle à manger'],
            ['sorano-2.jpg', 'Cuisine équipée'],
            ['sorano-3.jpg', 'Chambre'],
            ['sorano-4.jpg', 'Chambre'],
            ['sorano-5.jpg', 'Salle de bain'],
        ],
        'logements' => [
            ['nom' => 'F4 · 3 chambres', 'type' => 'appartement', 'capacite' => 6, 'nuitee' => 200000],
        ],
    ],

    [
        'nom' => 'Studio meublé · Immeuble Mame Aïssata Diallo',
        'adresse' => 'Rue Amadou Assane Ndoye x Wagane Diouf',
        'ville' => 'Dakar',
        'quartier' => 'Plateau',
        'description' => <<<TEXTE
            {$proposePar}

            Studio (F2) meublé au 4e étage de l'immeuble Mame Aïssata Diallo, à Dakar-Plateau.

            • Séjour, salle à manger, cuisine
            • 1 chambre avec salle de bain
            • Chauffe-eau, ascenseur, suppresseur

            Tarifs : 75 000 F la nuitée · au mois : 1 200 000 F (3 mois et plus), 1 000 000 F (à l'année).
            TEXTE,
        'photos' => [
            ['mame-aissata-1.jpg', 'Séjour du studio'],
        ],
        'logements' => [
            ['nom' => 'Studio · 1 chambre', 'type' => 'studio', 'capacite' => 2, 'nuitee' => 75000],
        ],
    ],

    [
        'nom' => 'Résidence SOWDI · Mermoz',
        'adresse' => 'Près du cinéma Pathé et d\'Auchan',
        'ville' => 'Dakar',
        'quartier' => 'Mermoz',
        'description' => <<<TEXTE
            {$proposePar}

            Résidence neuve à Mermoz, près du cinéma Pathé et d'Auchan. Conciergerie, pressing et nettoyage inclus ; vigile et caméras de surveillance ; ascenseur et suppresseur.

            Quatre logements :
            • Studio présidentiel — rez-de-chaussée, 79 m², orientation sud-ouest, terrasse de 3 m² ; chambre avec salle de bain, séjour avec coin repas, cuisine fermée.
            • Appartement 2 chambres (B) — 2e étage, 112 m², orientation sud-est ; 2 chambres avec salle de bain, séjour et salle à manger, cuisine américaine et cuisine africaine, dressings, coffre-fort.
            • Appartement 2 chambres (A) — 2e étage, 145 m², orientation nord-est, balcon de 18 m² ; 2 chambres avec salle de bain, séjour et salle à manger, cuisine américaine et cuisine africaine, dressings, coffre-fort.
            • Duplex 5 chambres — 3e et 4e étages, 536 m², orientation nord-est ; balcon de 23 m², terrasse-jardin de 85 m², espace piscine et gym de 48 m² ; 5 chambres avec salle de bain, séjour et salle à manger, cuisine américaine et cuisine africaine, dressings, jacuzzi.

            Tarifs par nuitée selon la durée du séjour (3 à 10 nuits / 11 à 20 nuits / 21 à 30 nuits), et au mois (30 nuits) :
            • Studio présidentiel : 95 000 / 90 000 / 85 000 F · 2 550 000 F le mois
            • 2 chambres (B) : 130 000 / 125 000 / 115 000 F · 3 450 000 F le mois
            • 2 chambres (A) : 140 000 / 135 000 / 125 000 F · 3 750 000 F le mois
            • Duplex 5 chambres : 380 000 / 350 000 / 300 000 F · 9 000 000 F le mois
            TEXTE,
        'photos' => [
            ['sowdi-2ch-a-1.jpg', 'Séjour de l\'appartement 2 chambres (A)'],
            ['sowdi-2ch-b-1.jpg', 'Séjour de l\'appartement 2 chambres (B)'],
            ['sowdi-studio-1.jpg', 'Séjour du studio présidentiel'],
            ['sowdi-2ch-a-4.jpg', 'Chambre de l\'appartement 2 chambres (A)'],
            ['sowdi-2ch-b-5.jpg', 'Cuisine de l\'appartement 2 chambres (B)'],
        ],
        'logements' => [
            ['nom' => 'Studio présidentiel · 79 m²', 'type' => 'studio', 'capacite' => 2, 'nuitee' => 95000],
            ['nom' => 'Appartement 2 chambres (B) · 112 m²', 'type' => 'appartement', 'capacite' => 4, 'nuitee' => 130000],
            ['nom' => 'Appartement 2 chambres (A) · 145 m²', 'type' => 'appartement', 'capacite' => 4, 'nuitee' => 140000],
            ['nom' => 'Duplex 5 chambres · 536 m²', 'type' => 'appartement', 'capacite' => 10, 'nuitee' => 380000],
        ],
    ],

    [
        'nom' => 'Résidence Cristallines · bord de mer',
        'adresse' => 'Résidence Cristallines, en bord de mer',
        'ville' => 'Saly',
        'quartier' => null,
        'description' => <<<TEXTE
            {$proposePar}

            Résidence en bord de mer à Saly, avec grande piscine collective, plage aménagée et toutes les commodités à proximité.

            Deux logements :
            • Studio — 66 m² habitables : 1 chambre, salle d'eau, WC, séjour, salle à manger, cuisine américaine équipée, buanderie ; terrasse couverte avec vue sur la mer et sur la grande piscine.
            • Appartement 2 chambres — 2 chambres, salon, salle à manger, cuisine américaine ; terrasse couverte avec vue sur la mer.

            Tarifs : studio 50 000 F la nuitée (550 000 F le mois) · appartement 2 chambres 60 000 F la nuitée (600 000 F le mois).
            TEXTE,
        'photos' => [
            ['cristallines-studio-1.jpg', 'Séjour du studio'],
            ['cristallines-2ch-1.jpg', 'Salon de l\'appartement 2 chambres'],
            ['cristallines-studio-4.jpg', 'La grande piscine de la résidence'],
            ['cristallines-studio-5.jpg', 'Le jardin de la résidence'],
            ['cristallines-2ch-4.jpg', 'Chambre de l\'appartement 2 chambres'],
        ],
        'logements' => [
            ['nom' => 'Studio · 66 m²', 'type' => 'studio', 'capacite' => 2, 'nuitee' => 50000],
            ['nom' => 'Appartement 2 chambres', 'type' => 'appartement', 'capacite' => 4, 'nuitee' => 60000],
        ],
    ],

    [
        'nom' => 'Case meublée en résidence bord de mer',
        'adresse' => 'Résidence sécurisée en bord de mer',
        'ville' => 'Saly',
        'quartier' => null,
        'description' => <<<TEXTE
            {$proposePar}

            Case entièrement équipée et meublée, dans une résidence en bord de mer sécurisée et bien gardiennée, avec restaurant gastronomique.

            • Chambre en mezzanine climatisée
            • Salon, cuisine américaine
            • Salle d'eau et WC au rez-de-chaussée
            • Terrasse, buanderie

            Tarifs : 55 000 F la nuitée · 550 000 F le mois.
            TEXTE,
        'photos' => [
            ['case-saly-1.jpg', 'La case dans la résidence'],
            ['case-saly-2.jpg', 'Le salon'],
            ['case-saly-3.jpg', 'La chambre en mezzanine'],
        ],
        'logements' => [
            ['nom' => 'Case · chambre en mezzanine', 'type' => 'appartement', 'capacite' => 2, 'nuitee' => 55000, 'clim' => true],
        ],
    ],

    [
        'nom' => 'Villa 4 chambres près d\'Auchan',
        'adresse' => 'Entre Saly et Ngaparou, près d\'Auchan',
        'ville' => 'Saly',
        'quartier' => null,
        'description' => <<<TEXTE
            {$proposePar}

            Villa de 451 m² bâtis sur un terrain de 1 500 m², entre Saly et Ngaparou, près d'Auchan.

            • 4 chambres avec salle d'eau
            • Grand salon ouvert sur l'extérieur, cuisine entièrement équipée, buanderie
            • Grande terrasse et paillote avec vue sur la piscine et le jardin arboré
            • Stationnement pour plusieurs véhicules

            Tarifs : 200 000 F la nuitée · 1 300 000 F le mois.
            TEXTE,
        'photos' => [
            ['villa-ngaparou-4ch-1.jpg', 'La villa et sa terrasse'],
        ],
        'logements' => [
            ['nom' => 'Villa entière · 4 chambres', 'type' => 'villa_entiere', 'capacite' => 8, 'nuitee' => 200000],
        ],
    ],

    [
        'nom' => 'Villa 5 chambres avec piscine privée',
        'adresse' => 'En deuxième position de la plage',
        'ville' => 'Ngaparou',
        'quartier' => null,
        'description' => <<<TEXTE
            {$proposePar}

            Villa de 190 m² habitables sur un terrain de 350 m², en deuxième position de la plage, dans un quartier résidentiel proche des écoles, des banques et des commerces.

            • 5 chambres et 5 salles de bain (2 au rez-de-chaussée, 3 à l'étage avec grande terrasse)
            • Salon, salle à manger, cuisine américaine
            • Piscine privée et espace séjour extérieur
            • Abri voiture, local gardien

            Tarifs : 150 000 F la nuitée · 1 000 000 F le mois.
            TEXTE,
        'photos' => [
            ['villa-ngaparou-5ch-1.jpg', 'La piscine privée'],
            ['villa-ngaparou-5ch-2.jpg', 'La cuisine'],
            ['villa-ngaparou-5ch-3.jpg', 'Une chambre'],
            ['villa-ngaparou-5ch-4.jpg', 'Le salon et la salle à manger'],
            ['villa-ngaparou-5ch-5.jpg', 'L\'espace séjour extérieur'],
        ],
        'logements' => [
            ['nom' => 'Villa entière · 5 chambres', 'type' => 'villa_entiere', 'capacite' => 10, 'nuitee' => 150000],
        ],
    ],

    [
        'nom' => 'Villa 3 chambres avec piscine',
        'adresse' => 'Somone',
        'ville' => 'Somone',
        'quartier' => null,
        'description' => <<<TEXTE
            {$proposePar}

            Villa avec piscine privée sur un terrain de 300 m², à la Somone.

            • 3 chambres, 3 salles de bain, WC visiteurs
            • Salon, cuisine équipée
            • Piscine privée, abri voiture

            Tarifs : 150 000 F la nuitée · 1 200 000 F le mois.
            TEXTE,
        'photos' => [
            ['villa-somone-3ch-1.jpg', 'La piscine et la terrasse'],
            ['villa-somone-3ch-2.jpg', 'La terrasse'],
            ['villa-somone-3ch-3.jpg', 'La piscine privée'],
            ['villa-somone-3ch-4.jpg', 'La salle à manger couverte'],
            ['villa-somone-3ch-5.jpg', 'La piscine'],
        ],
        'logements' => [
            ['nom' => 'Villa entière · 3 chambres', 'type' => 'villa_entiere', 'capacite' => 6, 'nuitee' => 150000],
        ],
    ],

];
