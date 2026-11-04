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
        // Vides tant que l'immatriculation n'est pas reçue : rien n'est imprimé.
        'adresse'  => env('ENTREPRISE_ADRESSE'),
        'ninea'    => env('ENTREPRISE_NINEA'),
        'rccm'     => env('ENTREPRISE_RCCM'),
    ],

    'conditions' => [
        'console' => 'Devis établi pour la prestation décrite ci-dessus. La réservation sera confirmée '
            .'selon les modalités convenues avec PasseTemps.',
        'site'    => 'Devis établi en ligne à la demande du client, sous réserve de disponibilité aux dates '
            .'indiquées. La réservation n’est confirmée qu’après accord de l’équipe PasseTemps et '
            .'règlement selon les modalités convenues.',
    ],

];
