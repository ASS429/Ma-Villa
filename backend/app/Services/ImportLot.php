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
 * Importe un lot d'hébergements transmis par l'exploitant, pour plusieurs
 * propriétaires, dans le circuit des associés.
 *
 * Clé d'Or puis Virage avaient chacun leur import, taillé pour un seul
 * propriétaire et un seul logement par annonce. Un lot réunit ce qu'ils
 * savaient faire séparément, plus ce qui leur manquait : plusieurs logements
 * par annonce, une formule avec les repas, une durée minimale, un prix à la
 * semaine ou au mois.
 *
 * ── À qui ────────────────────────────────────────────────────────────
 * Chaque propriétaire est désigné par l'empreinte SHA-256 de son adresse — le
 * dépôt est public — ou par son nom seul. Si aucun compte ne correspond,
 * l'annonce va sous un compte à son nom, sans boîte aux lettres, comme Clé
 * d'Or : elle paraît tout de suite, et la console la rattache au vrai compte
 * (« Utilisateurs ») le jour où il existe.
 *
 * ── Une seule fois ───────────────────────────────────────────────────
 * Si la première annonce du lot existe déjà, on ne fait rien : une annonce
 * retirée par l'administration reste retirée.
 */
class ImportLot
{
    public function __construct(private readonly string $dossier) {}

    /**
     * @return array{annonces: int, logements: int, photos: int, rattaches: array<string, bool>}|null  null si déjà fait
     */
    public function executer(): ?array
    {
        $lot = require base_path("{$this->dossier}/annonces.php");

        if (Villa::where('nom', $lot['annonces'][0]['nom'])->exists()) {
            return null;
        }

        $taux = (float) config('paiement.associes.majoration');
        $bilan = ['annonces' => 0, 'logements' => 0, 'photos' => 0, 'rattaches' => []];

        // Les photos hors transaction : un envoi vers le stockage objet ne
        // s'annule pas avec la base.
        $urls = [];
        foreach ($lot['annonces'] as $i => $annonce) {
            foreach ($annonce['photos'] as [$fichier, $alt]) {
                if ($url = $this->envoyer($fichier)) {
                    $urls[$i][] = [$url, $alt];
                }
            }
        }

        DB::transaction(function () use ($lot, $urls, $taux, &$bilan) {
            $comptes = [];
            foreach ($lot['proprietaires'] as $cle => $proprietaire) {
                $compte = $this->compte($proprietaire['empreinte']);
                $bilan['rattaches'][$cle] = $compte !== null;

                $compte ??= User::firstOrCreate(['email' => $proprietaire['attente']['email']], [
                    'name'     => $proprietaire['attente']['nom'],
                    'password' => Hash::make(Str::random(48)),
                    'role'     => 'proprietaire',
                ]);

                // Inscrit comme client : il devient propriétaire, sinon son
                // espace ne lui montrerait pas ses annonces.
                if ($compte->role === 'client') {
                    $compte->forceFill(['role' => 'proprietaire'])->save();
                }
                $comptes[$cle] = $compte;
            }

            foreach ($lot['annonces'] as $i => $annonce) {
                $compte = $comptes[$annonce['proprietaire']];
                $villa = Villa::create([
                    'user_id'     => $compte->id,
                    'nom'         => $annonce['nom'],
                    'description' => $annonce['description'],
                    'adresse'     => $annonce['adresse'],
                    'ville'       => $annonce['ville'],
                    'quartier'    => $annonce['quartier'],
                    'telephone'   => $compte->phone,
                    'statut'      => 'validee',
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

                foreach ($annonce['logements'] as $donnees) {
                    $logement = Logement::create([
                        'villa_id'      => $villa->id,
                        'nom'           => $donnees['nom'],
                        'type'          => $donnees['type'],
                        'capacite'      => $donnees['capacite'],
                        'nuits_minimum' => $donnees['nuits_minimum'] ?? 1,
                        'meuble'        => true,
                        'disponible'    => true,
                    ]);
                    $bilan['logements']++;

                    foreach ($donnees['tarifs'] as $tarif) {
                        Tarif::create([
                            'logement_id'  => $logement->id,
                            'type_tarif'   => 'nuitee',
                            'prix'         => Majoration::prix($tarif['prix'], $taux),
                            'prix_semaine' => isset($tarif['semaine']) ? Majoration::prix($tarif['semaine'], $taux) : null,
                            'prix_mois'    => isset($tarif['mois']) ? Majoration::prix($tarif['mois'], $taux) : null,
                            'avec_clim'    => $donnees['clim'] ?? false,
                            'avec_buffet'  => $tarif['repas'] ?? false,
                        ]);
                    }
                }
            }
        });

        return $bilan;
    }

    /** Le compte dont l'adresse a cette empreinte, sans jamais écrire l'adresse. */
    protected function compte(?string $empreinte): ?User
    {
        if ($empreinte === null) {
            return null;
        }

        return User::where('role', '!=', 'admin')
            ->select(['id', 'email'])
            ->cursor()
            ->first(fn (User $u) => hash('sha256', mb_strtolower(trim((string) $u->email))) === $empreinte)
            ?->fresh();
    }

    private function envoyer(string $fichier): ?string
    {
        $source = base_path("{$this->dossier}/{$fichier}");

        try {
            $disque = config('filesystems.media');
            $chemin = 'uploads/'.basename($this->dossier).'/'.Str::random(12)."-{$fichier}";
            Storage::disk($disque)->put($chemin, file_get_contents($source), 'public');
            $url = Storage::disk($disque)->url($chemin);

            return str_starts_with($url, 'http') ? $url : url($url);
        } catch (\Throwable $e) {
            Log::error('Import d\'un lot : photo non envoyée', ['fichier' => $fichier, 'erreur' => $e->getMessage()]);

            return null;
        }
    }
}
