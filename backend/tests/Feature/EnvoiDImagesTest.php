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
}
