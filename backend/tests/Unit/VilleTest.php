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

    /**
     * L'ordre de **référence** va du plus précis au plus général.
     *
     * C'est lui qui tranche « Mbour Saly » : si Mbour passait devant, l'annonce
     * serait rangée à Mbour avec « Saly » pour quartier.
     *
     * ⚠️ Il se lit dans la configuration, **pas** dans `Ville::liste()` : celle-ci
     * sert l'interface et range les villes pourvues d'abord, le reste par ordre
     * alphabétique. Ce test portait sur elle et tenait par coïncidence, tant que
     * les deux ordres n'en faisaient qu'un.
     */
    public function test_l_ordre_de_reference_va_du_plus_precis_au_plus_general(): void
    {
        $reference = config('villes.liste');

        foreach ([['Saly', 'Mbour'], ['Rufisque', 'Dakar']] as [$precise, $generale]) {
            $this->assertLessThan(
                array_search($generale, $reference, true),
                array_search($precise, $reference, true),
                "{$precise} doit précéder {$generale} dans config/villes.php"
            );
        }

        // Et la conséquence, vérifiée sur le comportement lui-même.
        $this->assertSame('Saly', Ville::normaliser('Mbour Saly')['ville']);
    }

    /**
     * La liste **proposée** n'est pas celle de l'algorithme.
     *
     * `config('villes.liste')` va du plus précis au plus général pour ranger
     * « Mbour Saly » sous Saly. Servie telle quelle, elle mettait Dakar en
     * douzième position derrière cinq villages sans annonce.
     */
    public function test_les_villes_pourvues_passent_devant(): void
    {
        $liste = Ville::liste(['Dakar', 'Saly']);

        $this->assertSame(['Dakar', 'Saly'], array_slice($liste, 0, 2));
        $this->assertSame(count($liste), count(array_unique($liste)), 'Aucune ville ne doit apparaître deux fois');
    }

    /** Le reste se lit comme une liste, donc par ordre alphabétique. */
    public function test_le_reste_de_la_liste_est_alphabetique(): void
    {
        $reste = array_slice(Ville::liste(['Saly']), 1);

        $this->assertSame('Cap Skirring', $reste[0]);
        $this->assertLessThan(
            array_search('Thiès', $reste, true),
            array_search('Saint-Louis', $reste, true),
            'Saint-Louis vient avant Thiès'
        );
    }

    /** Une ville pourvue mais absente de la référence a quand même des annonces. */
    public function test_une_ville_pourvue_hors_reference_est_proposee(): void
    {
        $liste = Ville::liste(['Mbodiène']);

        $this->assertSame('Mbodiène', $liste[0]);
    }

    /** Sans annonce nulle part, la liste reste entièrement alphabétique. */
    public function test_sans_annonce_la_liste_est_alphabetique(): void
    {
        $liste = Ville::liste();

        $this->assertSame('Cap Skirring', $liste[0]);
        $this->assertContains('Saly', $liste);
    }
}
