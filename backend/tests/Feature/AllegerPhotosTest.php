<?php

namespace Tests\Feature;

use App\Models\Photo;
use App\Models\Villa;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Les photos déjà en ligne trop lourdes : la commande simule par défaut, et
 * n'écrit qu'avec `--appliquer`, en gardant l'original et la même adresse.
 */
class AllegerPhotosTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        if (! function_exists('imagecreatetruecolor')) {
            $this->markTestSkipped('GD absente de cet environnement.');
        }
        config(['filesystems.media' => 'public']);
        Storage::fake('public');
    }

    /** Une photo de téléphone en portrait, enregistrée comme avant la correction. */
    private function photoEnLigne(string $nom, int $largeur, int $hauteur): Photo
    {
        $image = imagecreatetruecolor($largeur, $hauteur);
        // Du bruit, pour qu'elle pèse ce que pèse une vraie photo.
        for ($i = 0; $i < 4000; $i++) {
            imagefilledrectangle($image, random_int(0, $largeur), random_int(0, $hauteur), random_int(0, $largeur), random_int(0, $hauteur), random_int(0, 0xFFFFFF));
        }
        ob_start();
        imagejpeg($image, null, 95);
        Storage::disk('public')->put("uploads/{$nom}", (string) ob_get_clean());

        return Photo::create([
            'photoable_type' => Villa::class,
            'photoable_id' => Villa::factory()->create()->id,
            'url' => Storage::disk('public')->url("uploads/{$nom}"),
            'ordre' => 0,
        ]);
    }

    public function test_sans_appliquer_rien_n_est_ecrit(): void
    {
        $photo = $this->photoEnLigne('portrait.jpg', 1200, 2600);
        $avant = Storage::disk('public')->get('uploads/portrait.jpg');

        $this->artisan('passetemps:alleger-photos')
            ->expectsOutputToContain('allégerait uploads/portrait.jpg')
            ->assertSuccessful();

        $this->assertSame($avant, Storage::disk('public')->get('uploads/portrait.jpg'));
        $this->assertFalse(Storage::disk('public')->exists('originaux/uploads/portrait.jpg'));
        $this->assertSame($photo->url, $photo->fresh()->url);
    }

    public function test_appliquer_reduit_garde_l_original_et_l_adresse(): void
    {
        $photo = $this->photoEnLigne('portrait.jpg', 1200, 2600);
        $avant = Storage::disk('public')->get('uploads/portrait.jpg');

        $this->artisan('passetemps:alleger-photos', ['--appliquer' => true])->assertSuccessful();

        [$largeur, $hauteur] = getimagesizefromstring(Storage::disk('public')->get('uploads/portrait.jpg'));
        $this->assertSame(2000, $hauteur, 'Le grand côté n’a pas été ramené à 2000 px.');
        $this->assertSame(923, $largeur);
        $this->assertSame($avant, Storage::disk('public')->get('originaux/uploads/portrait.jpg'), 'L’original n’a pas été gardé.');
        $this->assertSame($photo->url, $photo->fresh()->url, 'L’adresse de la photo a changé.');
    }

    public function test_une_photo_deja_legere_et_une_adresse_d_ailleurs_ne_bougent_pas(): void
    {
        $this->photoEnLigne('petite.jpg', 800, 600);
        $avant = Storage::disk('public')->get('uploads/petite.jpg');
        Photo::create(['photoable_type' => Villa::class, 'photoable_id' => Villa::factory()->create()->id, 'url' => 'https://photos.example/ailleurs.jpg', 'ordre' => 0]);

        $this->artisan('passetemps:alleger-photos', ['--appliquer' => true])
            ->expectsOutputToContain('1 photo(s) examinée(s), 0 allégée(s)')
            ->assertSuccessful();

        $this->assertSame($avant, Storage::disk('public')->get('uploads/petite.jpg'));
        $this->assertFalse(Storage::disk('public')->exists('originaux/uploads/petite.jpg'));
    }
}
