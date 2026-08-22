<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Tâches périodiques
|--------------------------------------------------------------------------
*/

/*
 | Le rappel de PayDunya n'est pas une garantie : il peut ne jamais arriver.
 | Sans ce rattrapage, un versement resterait « en cours » indéfiniment et son
 | montant disparaîtrait des deux consoles à la fois — plus dans la file
 | d'attente puisqu'il est rattaché, pas encore versé puisqu'il n'a pas abouti.
 | C'est ainsi que de l'argent se perd de vue.
 |
 | Toutes les cinq minutes : assez pour que personne n'attende, assez peu pour
 | ne pas marteler l'API du prestataire. `withoutOverlapping` évite deux passes
 | simultanées sur la même transaction si l'une prend du retard.
 */
/*
 | Une demande sans reponse coute plus cher qu'un refus : le client attend, ne
 | cherche pas ailleurs, et decouvre trop tard qu'il n'a nulle part ou dormir.
 |
 | Toutes les heures : le delai est de vingt-quatre heures, une precision a
 | l'heure suffit et evite de reveiller la base toutes les cinq minutes pour
 | une requete qui ne rendra presque toujours rien.
 */
Schedule::command('mavilla:annuler-demandes-sans-reponse')
    ->hourly()
    ->withoutOverlapping()
    ->runInBackground();

Schedule::command('mavilla:suivre-reversements')
    ->everyFiveMinutes()
    ->withoutOverlapping()
    ->runInBackground();
