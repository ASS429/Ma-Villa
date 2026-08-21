<?php

namespace Database\Seeders;

use App\Models\Oeuvre;
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

        // La boutique se peuple dès qu'elle est ouverte, et seulement si elle
        // est vide. Deux gardes, et il faut les deux.
        //
        // `boutique.actif` : des articles fictifs ne doivent pas apparaître
        // parce qu'un conteneur a redémarré, mais parce qu'on a décidé d'ouvrir
        // le métier. Le compte : une fois le vrai catalogue saisi, ce
        // peuplement ne doit plus jamais intervenir — pas même pour « compléter ».
        //
        // C'est placé avant la garde des villas parce qu'il ne dépend pas
        // d'elles : une base où les villas existent déjà est exactement le cas
        // où l'on ouvre la boutique.
        if (config('boutique.actif') && Oeuvre::count() === 0) {
            $this->call(BoutiqueSeeder::class);
        }

        if (Villa::count() > 0) {
            $this->command?->info('Base déjà peuplée, données de démonstration ignorées.');

            return;
        }

        $this->call(VillaSeeder::class);
    }
}
