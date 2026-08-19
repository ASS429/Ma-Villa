<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Un versement effectué à un propriétaire.
 *
 * L'enregistrement, pas le mouvement de fonds : voir la migration.
 */
class Reversement extends Model
{
    protected $fillable = [
        'user_id', 'beneficiaire_nom', 'beneficiaire_telephone',
        'montant', 'methode', 'reference', 'note', 'verse_le',
        'cree_par', 'createur_nom',
    ];

    protected function casts(): array
    {
        return [
            'montant'  => 'decimal:2',
            'verse_le' => 'datetime',
        ];
    }

    public function beneficiaire(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function paiements(): HasMany
    {
        return $this->hasMany(Paiement::class);
    }

    /** Libellés d'affichage, côté serveur : les deux consoles les partagent. */
    public const METHODES = [
        'wave'         => 'Wave',
        'orange_money' => 'Orange Money',
        'virement'     => 'Virement bancaire',
        'especes'      => 'Espèces',
    ];
}
