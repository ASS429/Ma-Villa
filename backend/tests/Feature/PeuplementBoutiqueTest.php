<?php

namespace Tests\Feature;

use App\Models\Oeuvre;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Le peuplement de la boutique au démarrage.
 *
 * `start.sh` lance `php artisan db:seed --force` à chaque démarrage du
 * conteneur. C'est le seul endroit où une commande s'exécute en production sans
 * intervention — d'où l'importance des deux gardes.
 */
class PeuplementBoutiqueTest extends TestCase
{
    use RefreshDatabase;

    /** Boutique ouverte et vide : elle se remplit. */
    public function test_la_boutique_ouverte_et_vide_se_peuple(): void
    {
        config(['boutique.actif' => true]);

        $this->seed(DatabaseSeeder::class);

        $this->assertSame(19, Oeuvre::count());
        $this->assertSame(19, Oeuvre::has('photos')->count(), 'Chaque article doit avoir sa photo.');
    }

    /**
     * Boutique fermée : rien. Des articles fictifs ne doivent pas apparaître
     * parce qu'un conteneur a redémarré, mais parce qu'on a décidé d'ouvrir
     * le métier.
     */
    public function test_la_boutique_fermee_ne_se_peuple_pas(): void
    {
        config(['boutique.actif' => false]);

        $this->seed(DatabaseSeeder::class);

        $this->assertSame(0, Oeuvre::count());
    }

    /**
     * Le cas qui compte vraiment : une fois le vrai catalogue saisi, le
     * peuplement ne doit plus jamais intervenir — pas même pour « compléter ».
     * Sans cette garde, chaque redémarrage réinjecterait les articles fictifs
     * dans une boutique réelle.
     */
    public function test_une_boutique_deja_garnie_reste_intacte(): void
    {
        config(['boutique.actif' => true]);

        Oeuvre::create([
            'titre' => 'Le vrai catalogue', 'artiste' => 'Un artisan',
            'categorie' => 'bijoux', 'prix' => 12000, 'stock' => 3, 'statut' => 'publiee',
        ]);

        $this->seed(DatabaseSeeder::class);

        $this->assertSame(1, Oeuvre::count());
        $this->assertSame('Le vrai catalogue', Oeuvre::first()->titre);
    }

    /** Relancer sur une boutique fictive ne duplique rien non plus. */
    public function test_relancer_ne_duplique_pas(): void
    {
        config(['boutique.actif' => true]);

        $this->seed(DatabaseSeeder::class);
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(19, Oeuvre::count());
    }
}
