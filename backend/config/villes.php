<?php

/*
|--------------------------------------------------------------------------
| Villes
|--------------------------------------------------------------------------
|
| La ville d'une annonce était saisie librement. Six annonces ont suffi à
| produire six destinations — « Saly », « Saly bambara », « Saly velingara »,
| « Saly derrière rdc », « Mbour Saly », « Dakar » — pour deux lieux. Or c'est
| cette colonne qui alimente la recherche, la liste des destinations de
| l'accueil et le pré-rendu : un visiteur qui tape « Saly » cherche les cinq.
|
| Rien n'est perdu : ce qui dépasse la ville devient le quartier.
|
*/

return [

    /*
    | Les villes reconnues, **de la plus précise à la plus générale**.
    |
    | ⚠️ L'ordre n'est pas décoratif : il tranche les saisies qui nomment les
    | deux. « Mbour Saly » désigne une annonce à Saly, pas à Mbour — Saly figure
    | donc avant Mbour, et Rufisque avant Dakar.
    |
    | C'est aussi la liste proposée à la recherche et à la publication : elle est
    | servie par `/api/configuration`, pour qu'ajouter une ville ne demande pas
    | de redéployer l'interface.
    */
    'liste' => [
        'Saly', 'Somone', 'Ngaparou', 'Popenguine', 'Toubab Dialaw', 'Nianing',
        'Pointe Sarène', 'Joal-Fadiouth', 'Mbour', 'Diamniadio', 'Rufisque',
        'Dakar', 'Thiès', 'Lompoul', 'Saint-Louis', 'Cap Skirring', 'Kafountine',
        'Ziguinchor', 'Kolda', 'Kaolack', 'Fatick', 'Touba', 'Tambacounda',
        'Kédougou', 'Louga',
    ],

    /*
    | Les autres façons d'écrire **la ville elle-même**.
    |
    | Reconnues, elles disparaissent : « Saly Portudal » est Saly, et ne laisse
    | pas « Portudal » en quartier.
    |
    | Accents, casse, traits d'union et apostrophes sont déjà ignorés par la
    | comparaison : inutile de lister « saly », « Thies » ou « Saint Louis ».
    */
    'alias' => [
        'Saly'        => ['Saly Portudal', 'Saly Portudale', 'Sali'],
        'Saint-Louis' => ['Ndar'],
    ],

    /*
    | Les quartiers connus, qui **désignent leur ville sans la nommer**.
    |
    | « Ngor » est un quartier de Dakar, pas une destination à part — et
    | l'annonce de Malika Plage, dont le propriétaire a lui-même écrit
    | « Dakar », le confirme.
    |
    | ⚠️ À la différence d'un alias, un quartier reconnu est **conservé** : il
    | devient le quartier de l'annonce. Écrire « Ngor » donne Dakar · Ngor, et
    | non Dakar tout court — sinon ranger la ville reviendrait à effacer ce que
    | le propriétaire avait pris la peine de préciser.
    */
    'quartiers' => [
        'Dakar' => [
            'Ngor', 'Yoff', 'Almadies', 'Ouakam', 'Mermoz', 'Mamelles', 'Fann',
            'Plateau', 'Point E', 'Sacré-Cœur', 'Malika', 'Guédiawaye',
        ],
    ],

    /*
    | La ville qui en contient une autre.
    |
    | Citée avec elle, la plus grande est redondante : « Mbour Saly » est Saly,
    | et non un quartier de Saly qui s'appellerait Mbour. Sans cette table, le
    | quartier hériterait du nom de la commune.
    */
    'dans' => [
        'Saly'          => 'Mbour',
        'Somone'        => 'Mbour',
        'Ngaparou'      => 'Mbour',
        'Nianing'       => 'Mbour',
        'Pointe Sarène' => 'Mbour',
        'Diamniadio'    => 'Dakar',
        'Rufisque'      => 'Dakar',
    ],
];
