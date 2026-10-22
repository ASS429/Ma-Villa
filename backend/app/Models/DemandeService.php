<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Une demande de service d'un accompagnant (transport, repas).
 *
 * Elle ne réserve rien et n'encaisse rien : elle trace qu'une famille a demandé,
 * pour que personne ne l'oublie si le message WhatsApp ne part pas.
 */
class DemandeService extends Model
{
    protected $table = 'demandes_service';

    public const STATUTS = [
        'nouvelle'   => 'Nouvelle',
        'traitee'    => 'Traitée',
        'abandonnee' => 'Abandonnée',
    ];

    /**
     * D'où vient la demande : la page d'un service, ou la vitrine des JOJ.
     * C'est ce qui dira, après les Jeux, ce que la vitrine a réellement apporté.
     */
    public const ORIGINES = ['transport', 'restauration', 'joj'];

    /*
    | `statut`, `traitee_le` et `traitee_par` sont hors de `$fillable` : ils
    | appartiennent à l'administration. Un visiteur qui les enverrait ne doit
    | pas pouvoir créer une demande « déjà traitée », qui n'apparaîtrait dans
    | aucune file.
    */
    protected $fillable = [
        'user_id', 'prestation', 'date_service', 'heure', 'personnes', 'lieu',
        'latitude', 'longitude', 'precision_m',
        'vol', 'delegation', 'nom', 'telephone', 'email', 'message', 'langue',
        'origine',
    ];

    protected $appends = ['reference', 'libelle_prestation'];

    protected function casts(): array
    {
        return [
            'date_service' => 'date:Y-m-d',
            'personnes'    => 'integer',
            'latitude'     => 'float',
            'longitude'    => 'float',
            'precision_m'  => 'integer',
            'traitee_le'   => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function traiteePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'traitee_par');
    }

    /** Ce qu'on cite au téléphone : court, et sans ambiguïté avec une réservation. */
    public function getReferenceAttribute(): string
    {
        return 'S-'.str_pad((string) $this->id, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Le nom français de la prestation, pour la console.
     *
     * Une prestation retirée du catalogue garde sa clé plutôt que de disparaître :
     * la demande a existé, elle doit rester lisible.
     */
    public function getLibellePrestationAttribute(): string
    {
        return config("prestations.catalogue.{$this->prestation}.libelle.fr") ?? $this->prestation;
    }
}
