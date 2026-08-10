<?php

/*
 * Origines autorisées à appeler l'API.
 *
 * FRONTEND_URLS est une liste séparée par des virgules, définie par
 * environnement. Le repli couvre les ports de développement habituels (Vite web
 * et Expo mobile) ainsi que le domaine de production connu : sans lui, un
 * déploiement effectué avant d'avoir renseigné la variable couperait le site
 * de son API. Renseignez tout de même FRONTEND_URLS explicitement — le repli
 * est un garde-fou, pas la configuration.
 */
$repli = implode(',', [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8081',
    'https://mavilla-web.onrender.com',
]);

$origins = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('FRONTEND_URLS', $repli))
)));

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'storage/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $origins,

    // Les applications Expo/mobile en développement présentent une origine
    // dynamique (exp://…) : on l'autorise seulement hors production.
    'allowed_origins_patterns' => env('APP_ENV') === 'production'
        ? []
        : ['#^exp://#', '#^http://192\.168\.\d+\.\d+(:\d+)?$#'],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 86400,

    'supports_credentials' => false,
];
