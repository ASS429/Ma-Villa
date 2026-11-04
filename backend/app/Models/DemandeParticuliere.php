<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Une demande particulière sur une annonce : événement, séminaire, groupe,
 * long séjour. L'équipe y répond sur WhatsApp ou par e-mail, puis établit
 * souvent un devis.
 *
 * `statut`, `traitee_le` et `traitee_par` sont hors de `$fillable`, comme pour
 * les demandes de service : un visiteur ne crée pas une demande « traitée »,
 * qui n'apparaîtrait dans aucune file.
 */
class DemandeParticuliere extends Model
{
    protected $table = 'demandes_particulieres';

    public const TYPES = [
        'evenement'   => 'Événement privé',
        'seminaire'   => 'Séminaire ou entreprise',
        'groupe'      => 'Groupe ou famille',
        'long_sejour' => 'Long séjour',
        'autre'       => 'Autre demande',
    ];

    public const BESOINS = [
        'traiteur'     => 'Traiteur',
        'decoration'   => 'Décoration',
        'musique'      => 'Musique ou sono',
        'photographe'  => 'Photographe',
        'transport'    => 'Transport',
        'menage'       => 'Ménage en plus',
    ];

    public const STATUTS = [
        'nouvelle'   => 'Nouvelle',
        'traitee'    => 'Traitée',
        'abandonnee' => 'Abandonnée',
    ];

    protected $fillable = [
        'villa_id', 'user_id', 'type', 'date_debut', 'date_fin', 'dates_a_confirmer',
        'personnes_sejour', 'invites', 'besoins', 'budget', 'message',
        'nom', 'telephone', 'email', 'langue',
    ];

    protected $appends = ['reference', 'libelle_type'];

    protected function casts(): array
    {
        return [
            'date_debut'        => 'date:Y-m-d',
            'date_fin'          => 'date:Y-m-d',
            'dates_a_confirmer' => 'boolean',
            'personnes_sejour'  => 'integer',
            'invites'           => 'integer',
            'besoins'           => 'array',
            'budget'            => 'integer',
            'traitee_le'        => 'datetime',
        ];
    }

    public function villa(): BelongsTo
    {
        return $this->belongsTo(Villa::class);
    }

    public function traiteePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'traitee_par');
    }

    /** Ce qu'on cite au téléphone : P comme « particulière ». */
    public function getReferenceAttribute(): string
    {
        return 'P-'.str_pad((string) $this->id, 4, '0', STR_PAD_LEFT);
    }

    public function getLibelleTypeAttribute(): string
    {
        return self::TYPES[$this->type] ?? (string) $this->type;
    }
}
