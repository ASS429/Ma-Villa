<?php

namespace Tests\Unit;

use App\Services\MontantEnLettres;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * « Arrêté le présent devis à la somme de : … ». Une faute ici se lit sur un
 * document commercial : chaque règle de l'orthographe traditionnelle a son cas.
 */
class MontantEnLettresTest extends TestCase
{
    public static function nombres(): array
    {
        return [
            'zéro'                       => [0, 'zéro'],
            'un'                         => [1, 'un'],
            'seize'                      => [16, 'seize'],
            'dix-sept'                   => [17, 'dix-sept'],
            'vingt et un'                => [21, 'vingt et un'],
            'trente-deux'                => [32, 'trente-deux'],
            'soixante et onze'           => [71, 'soixante et onze'],
            'soixante-dix-sept'          => [77, 'soixante-dix-sept'],
            'quatre-vingts seul'         => [80, 'quatre-vingts'],
            'quatre-vingt-un'            => [81, 'quatre-vingt-un'],
            'quatre-vingt-onze'          => [91, 'quatre-vingt-onze'],
            'quatre-vingt-dix-neuf'      => [99, 'quatre-vingt-dix-neuf'],
            'cent'                       => [100, 'cent'],
            'cent un'                    => [101, 'cent un'],
            'deux cents seul'            => [200, 'deux cents'],
            'deux cent cinquante'        => [250, 'deux cent cinquante'],
            'mille'                      => [1000, 'mille'],
            'mille un'                   => [1001, 'mille un'],
            'deux mille'                 => [2000, 'deux mille'],
            'vingt et un mille'          => [21000, 'vingt et un mille'],
            'quatre-vingt mille'         => [80000, 'quatre-vingt mille'],
            'deux cent mille'            => [200000, 'deux cent mille'],
            'le devis de Kabrousse'      => [50000, 'cinquante mille'],
            'cinq cents en fin'          => [229500, 'deux cent vingt-neuf mille cinq cents'],
            'un million'                 => [1000000, 'un million'],
            'millions et quatre-vingt'   => [2280000, 'deux millions deux cent quatre-vingt mille'],
            'deux cents millions'        => [200000000, 'deux cents millions'],
            'un milliard'                => [1200000000, 'un milliard deux cents millions'],
        ];
    }

    #[DataProvider('nombres')]
    public function test_un_nombre_s_ecrit_en_toutes_lettres(int $nombre, string $attendu): void
    {
        $this->assertSame($attendu, MontantEnLettres::nombre($nombre));
    }

    /** @return array<string, array{int, string}> */
    public static function nombresAnglais(): array
    {
        return [
            'zéro'              => [0, 'zero'],
            'treize'            => [13, 'thirteen'],
            'vingt et un'       => [21, 'twenty-one'],
            'cent'              => [100, 'one hundred'],
            'cent cinq'         => [105, 'one hundred five'],
            'le devis'          => [50000, 'fifty thousand'],
            'cinq cents en fin' => [229500, 'two hundred twenty-nine thousand five hundred'],
            'millions'          => [2280000, 'two million two hundred eighty thousand'],
            'milliard'          => [1200000000, 'one billion two hundred million'],
        ];
    }

    #[DataProvider('nombresAnglais')]
    public function test_un_nombre_s_ecrit_aussi_en_anglais(int $nombre, string $attendu): void
    {
        $this->assertSame($attendu, MontantEnLettres::nombreAnglais($nombre));
    }

    public function test_les_cfa_francs_prennent_le_pluriel(): void
    {
        $this->assertSame('fifty thousand CFA francs', MontantEnLettres::cfaFrancs(50000));
        $this->assertSame('one CFA franc', MontantEnLettres::cfaFrancs(1));
    }

    public function test_les_francs_cfa_prennent_le_pluriel(): void
    {
        $this->assertSame('cinquante mille francs CFA', MontantEnLettres::francsCfa(50000));
        $this->assertSame('un franc CFA', MontantEnLettres::francsCfa(1));
    }
}
