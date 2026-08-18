<?php

namespace Database\Seeders;

use App\Models\Villa;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Toujours, même sur une base déjà remplie : ces comptes portaient un
        // mot de passe public, et tant que la sécurisation vivait derrière la
        // garde ci-dessous, elle n'était jamais exécutée en production.
        $this->call(ComptesSeeder::class);

        if (Villa::count() > 0) {
            $this->command?->info('Base déjà peuplée, données de démonstration ignorées.');

            return;
        }

        $this->call(VillaSeeder::class);
    }
}
