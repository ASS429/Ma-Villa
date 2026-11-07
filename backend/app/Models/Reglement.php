<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Une somme reçue hors du site : Wave sur le numéro de PasseTemps, espèces, virement…
 *
 * C'est une pièce comptable : numérotée, jamais effacée. Une erreur s'annule avec un motif,
 * et le numéro reste pris. Voir `App\Services\Encaissement`, seul à en écrire.
 */
class Reglement extends Model
{
    public const MOYENS = [
        'wave'         => 'Wave',
        'orange_money' => 'Orange Money',
        'especes'      => 'Espèces',
        'virement'     => 'Virement bancaire',
        'cheque'       => 'Chèque',
        'autre'        => 'Autre',
    ];

    public const MOYENS_EN = [
        'wave'         => 'Wave',
        'orange_money' => 'Orange Money',
        'especes'      => 'Cash',
        'virement'     => 'Bank transfer',
        'cheque'       => 'Cheque',
        'autre'        => 'Other',
    ];

    /** Rien de comptable ici : numéro, montant et statut se posent par le service. */
    protected $fillable = ['moyen', 'reference', 'payeur_telephone', 'recu_le', 'note'];

    protected $hidden = ['cle'];

    protected $appends = ['libelle_moyen', 'pdf'];

    protected function casts(): array
    {
        return [
            'montant'   => 'integer',
            'recu_le'   => 'date:Y-m-d',
            'annule_le' => 'datetime',
        ];
    }

    public function scopeValide(Builder $query): Builder
    {
        return $query->where('statut', 'valide');
    }

    public function devis(): BelongsTo
    {
        return $this->belongsTo(Devis::class);
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    public function villa(): BelongsTo
    {
        return $this->belongsTo(Villa::class);
    }

    /** Le trajet payé, quand le reçu n'est pas celui d'un séjour (depuis le 7 novembre 2026). */
    public function demandeService(): BelongsTo
    {
        return $this->belongsTo(DemandeService::class);
    }

    /**
     * Le rang du prochain reçu de l'année. À appeler dans une transaction : la ligne lue est
     * verrouillée, et séjours comme trajets tirent dans la même suite, sans trou ni doublon.
     */
    public static function prochainRang(int $annee): int
    {
        $dernier = self::where('annee', $annee)->orderByDesc('rang')->lockForUpdate()->value('rang');

        return $dernier ? $dernier + 1 : 1;
    }

    public function getLibelleMoyenAttribute(): string
    {
        return self::MOYENS[$this->moyen] ?? $this->moyen;
    }

    /** Le lien qui ouvre le reçu sans compte, comme celui d'un devis. */
    public function getPdfAttribute(): string
    {
        return url("/api/reglements/{$this->numero}/pdf?cle={$this->cle}");
    }

    public static function numero(int $annee, int $rang): string
    {
        return sprintf('RC-%d-%04d', $annee, $rang);
    }
}
