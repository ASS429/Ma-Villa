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

        // Le catalogue de démonstration ne se pose que si on le demande
        // explicitement.
        //
        // La garde était « boutique ouverte et catalogue vide ». Elle a tenu
        // tant que « vide » voulait dire « jamais rempli ». Le 1er septembre
        // 2026 les articles fictifs ont été effacés pour faire place au vrai
        // catalogue : la boutique est restée ouverte et le catalogue est
        // redevenu vide — les deux conditions réunies, le peuplement les
        // aurait ramenés au redémarrage suivant.
        //
        // Un réglage dédié dit ce qu'on veut vraiment : des données de
        // démonstration, ou pas. Il vaut `false` par défaut, donc rien ne
        // revient tout seul en production. Passer par la configuration et non
        // par `env()` : cette dernière rend `null` dès que la configuration
        // est mise en cache, ce que fait tout déploiement sérieux.
        if (config('boutique.demo') && Oeuvre::count() === 0) {
            $this->call(BoutiqueSeeder::class);
        }

        if (Villa::count() > 0) {
            $this->command?->info('Base déjà peuplée, données de démonstration ignorées.');

            return;
        }

        $this->call(VillaSeeder::class);
    }
}
