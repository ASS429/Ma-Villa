<?php

namespace App\Services;

use App\Models\Logement;
use App\Models\Photo;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Importe les logements meublés de Clé d'Or Immobilier et Services.
 *
 * Leur propriétaire est un compte à leur nom : c'est ce nom que la fiche
 * affiche (« Propriétaire : Clé d'Or Immobilier et Services »), et c'est la
 * demande de l'exploitant — dire à qui appartiennent ces logements.
 *
 * ── Une seule fois, et jamais après ──────────────────────────────────
 * Le compte existe : on ne fait rien, même si des annonces ont été retirées
 * depuis. Le piège du peuplement (une boutique vidée qui se remplissait de
 * nouveau à chaque démarrage) ne doit pas se rejouer : une annonce que
 * l'administration retire doit rester retirée.
 *
 * ── Le compte ────────────────────────────────────────────────────────
 * Adresse au domaine du site, qui ne reçoit pas de courrier, et mot de passe
 * aléatoire jamais communiqué : personne ne s'y connecte. Le jour où Clé d'Or
 * voudra gérer ses annonces, on lui donnera sa vraie adresse et elle fera
 * « mot de passe oublié ». Le numéro est celui de l'agence, sur chaque annonce,
 * révélé seulement une fois un séjour confirmé, comme pour tout propriétaire.
 */
class ImportCleDor
{
    public const EMAIL = 'cle-dor@passetemps.sn';

    public const NOM = "Clé d'Or Immobilier et Services";

    public const TELEPHONE = '77 592 56 58';

    private const DOSSIER = 'database/donnees/cle-dor';

    /**
     * @return array{annonces: int, logements: int, photos: int}|null  null si déjà fait
     */
    public function executer(): ?array
    {
        if (User::where('email', self::EMAIL)->exists()) {
            return null;
        }

        $annonces = require base_path(self::DOSSIER.'/annonces.php');
        $bilan = ['annonces' => 0, 'logements' => 0, 'photos' => 0];

        // Les photos d'abord, hors transaction : un envoi vers le stockage
        // objet ne s'annule pas avec la base. Une photo qui échoue est
        // journalisée et sautée — une annonce sans une de ses photos vaut
        // mieux qu'une API qui ne redémarre pas.
        $avatar = $this->envoyer('logo.jpg');
        $urls = [];
        foreach ($annonces as $i => $annonce) {
            foreach ($annonce['photos'] as [$fichier, $alt]) {
                $url = $this->envoyer($fichier);
                if ($url) {
                    $urls[$i][] = [$url, $alt];
                }
            }
        }

        DB::transaction(function () use ($annonces, $urls, $avatar, &$bilan) {
            $proprietaire = User::create([
                'name'     => self::NOM,
                'email'    => self::EMAIL,
                'password' => Hash::make(Str::random(48)),
                'role'     => 'proprietaire',
                'avatar'   => $avatar,
            ]);

            foreach ($annonces as $i => $annonce) {
                $villa = Villa::create([
                    'user_id'     => $proprietaire->id,
                    'nom'         => $annonce['nom'],
                    'description' => $annonce['description'],
                    'adresse'     => $annonce['adresse'],
                    'ville'       => $annonce['ville'],
                    'quartier'    => $annonce['quartier'],
                    'telephone'   => self::TELEPHONE,
                    // Validées : c'est l'exploitant qui les intègre, après
                    // les avoir reçues de ses partenaires. La console permet
                    // d'en retirer une, motif à l'appui.
                    'statut'      => 'validee',
                ]);
                $bilan['annonces']++;

                foreach ($urls[$i] ?? [] as $ordre => [$url, $alt]) {
                    Photo::create([
                        'photoable_id'   => $villa->id,
                        'photoable_type' => Villa::class,
                        'url'            => $url,
                        'alt'            => "{$annonce['nom']} — {$alt}",
                        'ordre'          => $ordre,
                    ]);
                    $bilan['photos']++;
                }

                foreach ($annonce['logements'] as $donnees) {
                    $logement = Logement::create([
                        'villa_id'   => $villa->id,
                        'nom'        => $donnees['nom'],
                        'type'       => $donnees['type'],
                        'capacite'   => $donnees['capacite'],
                        'meuble'     => true,
                        'disponible' => true,
                    ]);

                    Tarif::create([
                        'logement_id' => $logement->id,
                        'type_tarif'  => 'nuitee',
                        'prix'        => $donnees['nuitee'],
                        'avec_clim'   => (bool) ($donnees['clim'] ?? false),
                        'avec_buffet' => false,
                    ]);
                    $bilan['logements']++;
                }
            }
        });

        return $bilan;
    }

    /** Envoie une photo du dossier vers le stockage des médias ; son URL publique, ou null. */
    private function envoyer(string $fichier): ?string
    {
        $source = base_path(self::DOSSIER."/{$fichier}");

        try {
            $disque = config('filesystems.media');
            $chemin = 'uploads/cle-dor/'.Str::random(12)."-{$fichier}";
            Storage::disk($disque)->put($chemin, file_get_contents($source), 'public');
            $url = Storage::disk($disque)->url($chemin);

            return str_starts_with($url, 'http') ? $url : url($url);
        } catch (\Throwable $e) {
            Log::error('Import Clé d\'Or : photo non envoyée', ['fichier' => $fichier, 'erreur' => $e->getMessage()]);

            return null;
        }
    }
}
