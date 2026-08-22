<?php

/*
|--------------------------------------------------------------------------
| Notifications poussées (Web Push)
|--------------------------------------------------------------------------
|
| Les clés VAPID identifient *notre serveur* auprès des services de poussée
| (FCM pour Chrome, Mozilla pour Firefox, WNS pour Edge). Elles se génèrent
| une fois avec `php artisan push:cles` et ne changent plus jamais : les
| remplacer invalide d'un coup tous les abonnements existants, et chaque
| utilisateur doit réautoriser à la main.
|
| La clé publique est envoyée au navigateur — c'est normal, c'est son rôle.
| La clé privée ne sort jamais du serveur.
|
| Tant que les clés sont absentes, le bouton « activer les notifications »
| n'apparaît pas : rien ne casse, la fonction est simplement dormante.
|
*/

return [

    'actif' => (bool) env('PUSH_ACTIF', true),

    'vapid' => [
        // Adresse de contact exigée par la spécification : elle permet à un
        // service de poussée de joindre l'exploitant en cas d'abus.
        'sujet' => env('VAPID_SUJET', 'mailto:contactsmavilla@gmail.com'),
        'publique' => env('VAPID_CLE_PUBLIQUE', ''),
        'privee' => env('VAPID_CLE_PRIVEE', ''),
    ],

    /*
    | Nombre de refus consécutifs d'un service de poussée avant de retirer
    | l'abonnement. Un 404 ou 410 le supprime immédiatement — ces codes
    | signifient que l'abonnement n'existe plus. Ce seuil ne concerne que les
    | pannes passagères, qu'il ne faut pas confondre avec une désinscription.
    */
    'echecs_avant_retrait' => (int) env('PUSH_ECHECS_AVANT_RETRAIT', 5),

];
