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
    ],

];
