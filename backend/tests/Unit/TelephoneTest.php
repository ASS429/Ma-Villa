<?php

namespace Tests\Unit;

use App\Services\Telephone;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Aucun préfixe n'est filtré : chaque plage d'opérateur, mobile ou fixe, se
 * lit pareil, quelle que soit l'écriture de l'indicatif.
 */
class TelephoneTest extends TestCase
{
    /** @return array<string, array{string}> */
    public static function prefixes(): array
    {
        return [
            'Expresso 70'  => ['70'],
            'Orange 71'    => ['71'],
            'Promobile 75' => ['75'],
            'Free 76'      => ['76'],
            'Orange 77'    => ['77'],
            'Orange 78'    => ['78'],
            'fixe 33'      => ['33'],
            'fixe 30'      => ['30'],
        ];
    }

    #[DataProvider('prefixes')]
    public function test_toutes_les_ecritures_d_un_numero_senegalais_se_valent(string $prefixe): void
    {
        $attendu = "{$prefixe}1234567";

        foreach ([
            "{$prefixe} 123 45 67",
            "{$prefixe}1234567",
            "+221 {$prefixe} 123 45 67",
            "221{$prefixe}1234567",
            "00221 {$prefixe} 123 45 67",
            "00 221 {$prefixe}-123-45-67",
            "(+221) {$prefixe}.123.45.67",
        ] as $saisie) {
            $this->assertSame($attendu, Telephone::local($saisie), $saisie);
        }
    }

    public function test_un_numero_etranger_garde_son_indicatif(): void
    {
        $this->assertSame('33612345678', Telephone::local('+33 6 12 34 56 78'));
        $this->assertSame('33612345678', Telephone::local('0033 6 12 34 56 78'));
        $this->assertSame('2389912345', Telephone::local('+238 991 23 45'));
    }

    /** Ce que WhatsApp glisse autour d'un numéro copié : invisible, mais pas pour une règle. */
    public function test_le_nettoyage_retire_ce_qu_un_copier_coller_glisse(): void
    {
        $colle = "\u{202A}+221\u{00A0}78\u{00A0}123\u{00A0}45\u{00A0}67\u{202C}";

        $this->assertSame('+221 78 123 45 67', Telephone::nettoyer($colle));
        $this->assertSame('781234567', Telephone::local($colle));
        $this->assertNull(Telephone::nettoyer(null));
    }
}
