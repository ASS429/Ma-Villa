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
 * Importe les neuf logements de Virage et des Almadies (29 octobre 2026).
 *
 * ── À qui ────────────────────────────────────────────────────────────
 * Au compte que le propriétaire a créé lui-même. Le dépôt est public : son
 * adresse n'y figure pas, seulement son empreinte SHA-256, comparée à celle
 * de chaque compte. Introuvable — inscription supprimée, adresse changée — les
 * annonces vont sous un compte d'attente, **non publiées** : la console les
 * rattache au bon compte (« Utilisateurs »), puis les valide.
 *
 * ── Une seule fois ───────────────────────────────────────────────────
 * Comme Clé d'Or : si la première annonce existe déjà, on ne fait rien, pour
 * qu'une annonce retirée par l'administration reste retirée.
 *
 * ── Le prix ──────────────────────────────────────────────────────────
 * Circuit des associés : le prix du propriétaire est majoré à l'import, et
 * l'annonce porte sa majoration (`Majoration`).
 */
class ImportVirage
{
    public const EMPREINTE = '4d57fc088218f20783363c939b73d7facb8d2151e5629105b922c648d3a0f64f';

    public const EMAIL_ATTENTE = 'virage@passetemps.sn';

    private const DOSSIER = 'database/donnees/virage';

    /**
     * @return array{annonces: int, photos: int, rattachees: bool}|null  null si déjà fait
     */
    public function executer(): ?array
    {
        $annonces = require base_path(self::DOSSIER.'/annonces.php');

        if (Villa::where('nom', $annonces[0]['nom'])->exists()) {
            return null;
        }

        $taux = (float) config('paiement.associes.majoration');
        $proprietaire = $this->proprietaire();
        $bilan = ['annonces' => 0, 'photos' => 0, 'rattachees' => $proprietaire !== null];

        // Les photos hors transaction, comme pour Clé d'Or : un envoi vers le
        // stockage objet ne s'annule pas avec la base.
        $urls = [];
        foreach ($annonces as $i => $annonce) {
            foreach ($annonce['photos'] as [$fichier, $alt]) {
                if ($url = $this->envoyer($fichier)) {
                    $urls[$i][] = [$url, $alt];
                }
            }
        }

        DB::transaction(function () use ($annonces, $urls, $taux, &$proprietaire, &$bilan) {
            $proprietaire ??= User::firstOrCreate(['email' => self::EMAIL_ATTENTE], [
                'name'     => 'Propriétaire de Virage (à rattacher)',
                'password' => Hash::make(Str::random(48)),
                'role'     => 'proprietaire',
            ]);

            // Inscrit comme client : il devient propriétaire, sinon son
            // espace ne lui montrerait pas ses annonces.
            if ($proprietaire->role === 'client') {
                $proprietaire->forceFill(['role' => 'proprietaire'])->save();
            }

            foreach ($annonces as $i => $annonce) {
                $villa = Villa::create([
                    'user_id'     => $proprietaire->id,
                    'nom'         => $annonce['nom'],
                    'description' => $annonce['description'],
                    'adresse'     => $annonce['adresse'],
                    'ville'       => $annonce['ville'],
                    'quartier'    => $annonce['quartier'],
                    'telephone'   => $proprietaire->phone,
                    // Publiées seulement chez le bon propriétaire, et si rien
                    // ne reste à confirmer.
                    'statut'      => $bilan['rattachees'] && ($annonce['publiee'] ?? true) ? 'validee' : 'en_attente',
                ]);
                $villa->forceFill(['majoration' => $taux, 'circuit' => 'associe'])->save();
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

                $donnees = $annonce['logement'];
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
                    'prix'        => Majoration::prix($donnees['prix'], $taux),
                    'avec_clim'   => true,
                    'avec_buffet' => false,
                ]);
            }
        });

        return $bilan;
    }

    /** Le compte dont l'adresse a cette empreinte, sans jamais écrire l'adresse. */
    protected function proprietaire(): ?User
    {
        return User::where('role', '!=', 'admin')
            ->select(['id', 'email'])
            ->cursor()
            ->first(fn (User $u) => hash('sha256', mb_strtolower(trim((string) $u->email))) === $this->empreinte())
            ?->fresh();
    }

    protected function empreinte(): string
    {
        return self::EMPREINTE;
    }

    private function envoyer(string $fichier): ?string
    {
        $source = base_path(self::DOSSIER."/{$fichier}");

        try {
            $disque = config('filesystems.media');
            $chemin = 'uploads/virage/'.Str::random(12)."-{$fichier}";
            Storage::disk($disque)->put($chemin, file_get_contents($source), 'public');
            $url = Storage::disk($disque)->url($chemin);

            return str_starts_with($url, 'http') ? $url : url($url);
        } catch (\Throwable $e) {
            Log::error('Import Virage : photo non envoyée', ['fichier' => $fichier, 'erreur' => $e->getMessage()]);

            return null;
        }
    }
}
