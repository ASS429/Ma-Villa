<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Un devis, établi par l'équipe (console) ou par le client en ligne (site).
 *
 * Numéro, série, clé, lignes et total sont **hors de `$fillable`** : un numéro
 * se calcule, un montant aussi. Les poser depuis une requête, c'est laisser le
 * navigateur écrire un document commercial (cf. la faille du tarif).
 */
class Devis extends Model
{
    protected $table = 'devis';

    public const ORIGINES = ['console', 'site'];

    public const STATUTS = [
        'emis'    => 'Émis',
        'accepte' => 'Accepté',
        'refuse'  => 'Refusé',
    ];

    protected $fillable = [
        'villa_id', 'logement_id', 'tarif_id', 'titre',
        'client_nom', 'occupant_nom', 'client_telephone', 'client_email',
        'date_arrivee', 'date_depart', 'personnes',
        'valable_jusqu_au', 'conditions', 'cachet', 'langue',
    ];

    protected $hidden = ['cle'];

    protected function casts(): array
    {
        return [
            'lignes'           => 'array',
            'cachet'           => 'boolean',
            'total'            => 'integer',
            'date_arrivee'     => 'date:Y-m-d',
            'date_depart'      => 'date:Y-m-d',
            'date_emission'    => 'date:Y-m-d',
            'valable_jusqu_au' => 'date:Y-m-d',
            'suivi_le'         => 'datetime',
        ];
    }

    public function villa(): BelongsTo
    {
        return $this->belongsTo(Villa::class);
    }

    public function auteur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cree_par');
    }

    /** Le lien qui ouvre le PDF sans compte. */
    public function urlPdf(): string
    {
        return url("/api/devis/{$this->numero}/pdf?cle={$this->cle}");
    }

    /**
     * Les lignes, montants recalculés ici quoi qu'on reçoive.
     *
     * @param  array<int, array<string, mixed>>  $lignes
     * @return array{0: array<int, array<string, mixed>>, 1: int}
     */
    public static function calculer(array $lignes): array
    {
        $propres = [];
        $total = 0;
        foreach ($lignes as $ligne) {
            $quantite = max(1, (int) ($ligne['quantite'] ?? 1));
            $prix = max(0, (int) ($ligne['prix_unitaire'] ?? 0));
            $montant = $quantite * $prix;
            $total += $montant;
            $propres[] = [
                'designation'   => trim((string) ($ligne['designation'] ?? '')),
                'detail'        => filled($ligne['detail'] ?? null) ? trim((string) $ligne['detail']) : null,
                'quantite'      => $quantite,
                'unite'         => filled($ligne['unite'] ?? null) ? trim((string) $ligne['unite']) : null,
                'prix_unitaire' => $prix,
                'montant'       => $montant,
            ];
        }

        return [$propres, $total];
    }

    /**
     * Crée le devis à son rang dans la série de l'année.
     *
     * Le rang suivant se lit sous verrou ; deux créations simultanées peuvent
     * pourtant viser le même premier rang d'une année (rien à verrouiller
     * encore), et l'index unique refuse la seconde. Sous Postgres, ce refus
     * annule toute la transaction : on recommence donc la transaction entière.
     *
     * @param  array<string, mixed>  $attributs
     * @param  array<int, array<string, mixed>>  $lignes
     */
    public static function etablir(string $origine, array $attributs, array $lignes, ?User $auteur = null): self
    {
        [$lignes, $total] = self::calculer($lignes);
        $annee = (int) now()->format('Y');

        for ($essai = 0; ; $essai++) {
            try {
                return DB::transaction(function () use ($origine, $attributs, $lignes, $total, $annee, $auteur) {
                    $dernier = self::where('origine', $origine)->where('annee', $annee)
                        ->orderByDesc('rang')->lockForUpdate()->value('rang');
                    $depart = $origine === 'console' ? max(1, (int) config('devis.premier_numero', 1)) : 1;
                    $rang = $dernier ? $dernier + 1 : $depart;

                    $devis = new self($attributs);
                    $devis->origine = $origine;
                    $devis->annee = $annee;
                    $devis->rang = $rang;
                    $devis->numero = self::numero($origine, $annee, $rang);
                    $devis->cle = Str::random(40);
                    $devis->lignes = $lignes;
                    $devis->total = $total;
                    $devis->date_emission = now()->toDateString();
                    $devis->cree_par = $auteur?->id;
                    $devis->save();

                    return $devis;
                });
            } catch (UniqueConstraintViolationException $e) {
                if ($essai >= 4) {
                    throw $e;
                }
            }
        }
    }

    /** Remplace les lignes d'un devis existant ; le numéro ne bouge pas. */
    public function remplacerLignes(array $lignes): void
    {
        [$this->lignes, $this->total] = self::calculer($lignes);
    }

    public static function numero(string $origine, int $annee, int $rang): string
    {
        $prefixe = (string) config('devis.prefixe', 'PT');

        return $origine === 'site'
            ? sprintf('%s-%d-L%04d', $prefixe, $annee, $rang)
            : sprintf('%s-%d-%03d', $prefixe, $annee, $rang);
    }
}
