<?php

/*
|--------------------------------------------------------------------------
| Devis
|--------------------------------------------------------------------------
|
| Deux séries de numéros, pour qu'un devis établi en ligne n'entame pas celle
| de l'équipe :
|
|   console  PT-2026-002, PT-2026-003…   établi par l'équipe, cachet possible
|   site     PT-2026-L0001…              établi en ligne par le client, sans cachet
|
| PT-2026-001 a été fait à la main le 2 novembre 2026 : la série de la console
| reprend après lui, d'où `premier_numero` à 2.
|
*/

return [

    'prefixe' => env('DEVIS_PREFIXE', 'PT'),

    'premier_numero' => (int) env('DEVIS_PREMIER_NUMERO', 2),

    'validite_jours' => (int) env('DEVIS_VALIDITE_JOURS', 7),

    // Ce que le document dit de PasseTemps. Le numéro et l'adresse sont ceux du
    // contact : les changer sur Railway change aussi les devis.
    'emetteur' => [
        'nom'      => 'PasseTemps',
        'activite' => 'Plateforme de réservation · Hébergements au Sénégal',
        'site'     => 'passetemps.sn',
        // Immatriculée le 3 novembre 2026. Publics par nature, donc écrits ici : un document
        // sans NINEA ne doit pas dépendre d'une variable oubliée. La même chose côté site :
        // `Ma-Villa/src/coordonnees.json`, et un test vérifie qu'ils ne divergent pas.
        'titulaire' => 'Arfang Souleymane Sane',
        'ninea'    => env('ENTREPRISE_NINEA', '013512810'),
        'rccm'     => env('ENTREPRISE_RCCM', 'SN.DKR.2026.A.43219'),
        // Le siège est aussi un domicile : il ne s'imprime que si l'exploitant le pose sur Railway.
        'adresse'  => env('ENTREPRISE_ADRESSE'),
    ],

    'conditions' => [
        // Elles tiennent la promesse de l'article 6 des CGU : mode de règlement et conditions
        // d'annulation confirmés par écrit, avant tout paiement.
        'console' => 'Devis établi pour la prestation décrite ci-dessus. Le règlement se fait auprès de '
            .'l’équipe PasseTemps, contre un reçu : un premier règlement confirme la réservation et bloque '
            .'les dates, et le solde se règle avant l’arrivée. En cas d’annulation, la politique '
            .'d’annulation publiée sur passetemps.sn s’applique.',
        'site'    => 'Devis établi en ligne à la demande du client, sous réserve de disponibilité aux dates '
            .'indiquées. La réservation n’est confirmée qu’après accord de l’équipe PasseTemps et '
            .'règlement selon les modalités convenues. Un premier règlement bloque les dates, et le solde '
            .'se règle avant l’arrivée. En cas d’annulation, la politique d’annulation publiée sur '
            .'passetemps.sn s’applique.',
        'console_en' => 'Quote prepared for the service described above. Payment is made to the PasseTemps team '
            .'against a receipt: a first payment confirms the booking and holds the dates, and the balance is '
            .'due before arrival. If the booking is cancelled, the cancellation policy published on '
            .'passetemps.sn applies.',
        'site_en'    => 'Quote prepared online at the customer’s request, subject to availability on the dates '
            .'shown. The booking is only confirmed once the PasseTemps team has agreed and payment has been '
            .'made under the agreed terms. A first payment holds the dates, and the balance is due before '
            .'arrival. If the booking is cancelled, the cancellation policy published on passetemps.sn applies.',
        // Un trajet (7 novembre 2026) : ni dates à bloquer ni solde avant l'arrivée. CGU, article 7.
        'transport'    => 'Devis établi pour le trajet décrit ci-dessus. Le règlement se fait auprès de '
            .'l’équipe PasseTemps, une fois le trajet confirmé, contre un reçu ; PasseTemps reverse sa part '
            .'au transporteur, qui exécute le trajet et en répond. Annulation gratuite jusqu’à 24 h avant le départ.',
        'transport_en' => 'Quote prepared for the ride described above. Payment is made to the PasseTemps team '
            .'once the ride is confirmed, against a receipt; PasseTemps pays the driver his share, and the driver '
            .'carries out the ride and is answerable for it. Free cancellation up to 24 hours before departure.',
        // La location sans chauffeur : pas de trajet ni de chauffeur, mais un véhicule confié.
        'location'     => 'Devis établi pour la location décrite ci-dessus. Le règlement se fait auprès de '
            .'l’équipe PasseTemps, une fois la location confirmée, contre un reçu ; PasseTemps reverse sa part '
            .'au propriétaire du véhicule. Permis de conduire exigé, caution demandée à la remise des clés, '
            .'carburant à la charge du client, assurance comprise. Annulation gratuite jusqu’à 24 h avant.',
        'location_en'  => 'Quote prepared for the car hire described above. Payment is made to the PasseTemps team '
            .'once the hire is confirmed, against a receipt; PasseTemps pays the car owner his share. Driving '
            .'licence required, deposit taken when you collect the keys, fuel at your expense, insurance '
            .'included. Free cancellation up to 24 hours before.',
    ],

];
