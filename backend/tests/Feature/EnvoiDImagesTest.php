<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * L'envoi d'une image : réduite avant d'être servie, et jamais décodée quand
 * ses dimensions annoncées en feraient une bombe de mémoire.
 */
class EnvoiDImagesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['filesystems.media' => 'public']);
        Storage::fake('public');
    }

    /** Un PNG de quelques octets qui annonce des dimensions arbitraires. */
    private function pngAnnoncant(int $largeur, int $hauteur): UploadedFile
    {
        $entete = 'IHDR'.pack('NN', $largeur, $hauteur)."\x08\x02\x00\x00\x00";
        $octets = "\x89PNG\r\n\x1a\n".pack('N', 13).$entete.pack('N', crc32($entete));

        return UploadedFile::fake()->createWithContent('image.png', $octets);
    }

    public function test_une_image_aux_dimensions_demesurees_est_refusee_sans_etre_decodee(): void
    {
        // 30 000 × 30 000 : 900 Mpx, soit 3,6 Go une fois décodée.
        $this->actingAs(User::factory()->proprietaire()->create(), 'sanctum')
            ->postJson('/api/upload', ['file' => $this->pngAnnoncant(30000, 30000)])
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');

        $this->assertEmpty(Storage::disk('public')->allFiles());
    }

    public function test_une_photo_ordinaire_passe_et_ressort_en_jpeg(): void
    {
        if (! function_exists('imagecreatetruecolor')) {
            $this->markTestSkipped('GD absente de cet environnement.');
        }

        $reponse = $this->actingAs(User::factory()->proprietaire()->create(), 'sanctum')
            ->postJson('/api/upload', ['file' => UploadedFile::fake()->image('salon.png', 2400, 1600)])
            ->assertOk();

        $this->assertStringEndsWith('.jpg', $reponse->json('url'));
        $fichier = Storage::disk('public')->allFiles()[0];
        [$largeur] = getimagesizefromstring(Storage::disk('public')->get($fichier));
        $this->assertSame(2000, $largeur, 'La photo n’a pas été réduite à 2000 px de large.');
    }

    public function test_une_photo_en_portrait_est_reduite_par_son_grand_cote(): void
    {
        if (! function_exists('imagecreatetruecolor')) {
            $this->markTestSkipped('GD absente de cet environnement.');
        }

        // Moins de 2000 px de large, mais 2400 de haut : elle passait telle quelle.
        $this->actingAs(User::factory()->proprietaire()->create(), 'sanctum')
            ->postJson('/api/upload', ['file' => UploadedFile::fake()->image('chambre.jpg', 1600, 2400)])
            ->assertOk();

        [$largeur, $hauteur] = getimagesizefromstring(Storage::disk('public')->get(Storage::disk('public')->allFiles()[0]));
        $this->assertSame([1333, 2000], [$largeur, $hauteur]);
    }

    public function test_une_photo_couchee_par_le_telephone_est_redressee(): void
    {
        if (! function_exists('imagecreatetruecolor')) {
            $this->markTestSkipped('GD absente de cet environnement.');
        }

        // Des pixels en paysage, et l'étiquette EXIF 6 : « tourner d'un quart à droite ».
        $image = imagecreatetruecolor(300, 200);
        ob_start();
        imagejpeg($image);
        $jpeg = (string) ob_get_clean();
        $tiff = "II*\0".pack('V', 8).pack('v', 1).pack('vvV', 0x0112, 3, 1).pack('v', 6)."\0\0".pack('V', 0);
        $app1 = "Exif\0\0".$tiff;
        $octets = substr($jpeg, 0, 2)."\xFF\xE1".pack('n', strlen($app1) + 2).$app1.substr($jpeg, 2);

        $this->actingAs(User::factory()->proprietaire()->create(), 'sanctum')
            ->postJson('/api/upload', ['file' => UploadedFile::fake()->createWithContent('couchee.jpg', $octets)])
            ->assertOk();

        [$largeur, $hauteur] = getimagesizefromstring(Storage::disk('public')->get(Storage::disk('public')->allFiles()[0]));
        $this->assertSame([200, 300], [$largeur, $hauteur], 'La photo est restée couchée.');
    }
}
