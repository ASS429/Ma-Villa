<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['admin' => \App\Http\Middleware\AdminMiddleware::class]);

        // Ce back n'expose aucune interface, donc aucune route « login ». Le
        // middleware d'authentification y redirigeait pourtant toute requête
        // non authentifiée qui n'attendait pas du JSON — une URL d'API ouverte
        // dans un onglet — et levait « Route [login] not defined » avant même
        // d'atteindre le gestionnaire d'exceptions. Résultat : « 500 Server
        // Error » là où « 401 » était la réponse juste, et un diagnostic qui
        // devient un second bug à élucider.
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Ce back n'expose aucune interface, donc aucune route « login ». Sans
        // cette règle, une requête non authentifiée arrivant depuis un
        // navigateur — une URL d'API ouverte dans un onglet — fait chercher à
        // Laravel une redirection qui n'existe pas, et répond « 500 Server
        // Error » là où « 401 non authentifié » était la réponse juste.
        // Un diagnostic devient alors un second bug à élucider.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $requete) => $requete->is('api/*') || $requete->expectsJson()
        );
    })->create();
