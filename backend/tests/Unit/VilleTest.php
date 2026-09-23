<?php

namespace Tests\Unit;

use App\Services\Ville;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Les cas de ce test sont les vraies saisies des propriétaires, relevées en
 * production le 11 septembre 2026 — pas des exemples inventés.
 */
class VilleTest extends TestCase
{
    // L'attribut, et non `@dataProvider` en commentaire : PHPUnit ne lit plus
    // les métadonnées des blocs de documentation, et le test s'exécutait alors
    // sans aucun argument.
    #[DataProvider('saisies')]
    public function test_une_saisie_libre_se_range_sous_une_ville_connue(
        string $saisie,
        string $ville,
        ?string $quartier
    ): void {
        $this->assertSame(
            ['ville' => $ville, 'quartier' => $quartier],
            Ville::normaliser($saisie)
        );
    }

    public static function saisies(): array
    {
        return [
            'la ville seule'          => ['Saly', 'Saly', null],
            'la casse est ignorée'    => ['saly', 'Saly', null],
            'les accents aussi'       => ['THIES', 'Thiès', null],
            'le trait d\'union aussi' => ['Saint Louis', 'Saint-Louis', null],
            'espaces en trop'         => ['  Saly   ', 'Saly', null],

            // Les cinq Saly de la production, qui n'en font qu'un.
            'quartier accolé'      => ['Saly velingara', 'Saly', 'Velingara'],
            'autre quartier'       => ['Saly bambara', 'Saly', 'Bambara'],
            'un repère, pas un quartier' => ['Saly derrière rdc', 'Saly', 'Derrière rdc'],

            // La commune citée avec la localité ne devient pas un quartier.
            'commune devant'  => ['Mbour Saly', 'Saly', null],
            'commune derrière' => ['Saly Mbour', 'Saly', null],

            // Une variante connue est reconnue entière : « Portudal » ne reste
            // pas en quartier.
            'variante de la ville' => ['Saly Portudal', 'Saly', null],

            // Un quartier connu ramène à sa ville.
            'quartier de Dakar'      => ['Ngor', 'Dakar', 'Ngor'],
            'quartier et ville'      => ['Dakar Almadies', 'Dakar', 'Almadies'],

            // Ce qu'on ne connaît pas est gardé tel quel : la liste est
            // incomplète, pas la saisie.
            'ville inconnue' => ['Ndangane', 'Ndangane', null],

            // Une ville ne se reconnaît pas au milieu d'un mot.
            'pas de ville dans un prénom' => ['Salimata', 'Salimata', null],

            'saisie vide' => ['   ', '', null],
        ];
    }

    public function test_la_liste_proposee_commence_par_les_destinations_du_moment(): void
    {
        $liste = Ville::liste();

        $this->assertContains('Saly', $liste);
        $this->assertContains('Dakar', $liste);

        // L'ordre tranche « Mbour Saly » : si Mbour passait devant, l'annonce
        // serait rangée à Mbour avec « Saly » pour quartier.
        $this->assertLessThan(
            array_search('Mbour', $liste, true),
            array_search('Saly', $liste, true),
            'Saly doit précéder Mbour dans config/villes.php'
        );
    }
}
