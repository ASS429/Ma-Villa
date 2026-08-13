<?php

namespace App\Providers;

use App\Services\PayDunya;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Résolu à la demande plutôt qu'en singleton : la configuration change
        // d'un test à l'autre, et un singleton figerait les clés du premier.
        $this->app->bind(PayDunya::class, fn () => PayDunya::depuisConfig());
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
