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

    /** Catalogue de démonstration demandé, boutique vide : elle se remplit. */
    public function test_le_catalogue_de_demonstration_demande_se_pose(): void
    {
        config(['boutique.actif' => true, 'boutique.demo' => true]);

        $this->seed(DatabaseSeeder::class);

        $this->assertSame(19, Oeuvre::count());
        $this->assertSame(19, Oeuvre::has('photos')->count(), 'Chaque article doit avoir sa photo.');
    }

    /**
     * Boutique fermée : rien. Des articles fictifs ne doivent pas apparaître
     * parce qu'un conteneur a redémarré, mais parce qu'on l'a décidé.
     */
    public function test_la_boutique_fermee_ne_se_peuple_pas(): void
    {
        config(['boutique.actif' => false, 'boutique.demo' => false]);

        $this->seed(DatabaseSeeder::class);

        $this->assertSame(0, Oeuvre::count());
    }

    /**
     * ⚠️ Le cas qui a motivé le réglage, et le plus coûteux du lot.
     *
     * Le 1er septembre 2026, les articles fictifs ont été effacés pour faire
     * place au vrai catalogue. La boutique est restée **ouverte**, et le
     * catalogue est redevenu **vide** : sous l'ancienne garde — « ouverte et
     * vide » — le peuplement les aurait tous ramenés au redémarrage suivant,
     * dans une boutique que le public voit.
     *
     * Ouvrir le métier et y poser de faux articles sont deux décisions
     * distinctes, et ce test est ce qui les tient séparées.
     */
    public function test_une_boutique_ouverte_et_videe_ne_se_repeuple_pas(): void
    {
        config(['boutique.actif' => true, 'boutique.demo' => false]);

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
        config(['boutique.actif' => true, 'boutique.demo' => true]);

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
        config(['boutique.actif' => true, 'boutique.demo' => true]);

        $this->seed(DatabaseSeeder::class);
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(19, Oeuvre::count());
    }
}
