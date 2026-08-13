<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Une catégorie est un triplet : unité de prix, formules autorisées, jeu de
 * filtres. Ajouter « studio meublé » est désormais une ligne en base, pas une
 * mise en production.
 */
class Categorie extends Model
{
    protected $table = 'categories';

    protected $fillable = [
        'cle', 'nom', 'nom_pluriel', 'unite_prix', 'formules', 'filtres', 'ordre', 'actif',
    ];

    protected function casts(): array
    {
        return [
            'formules' => 'array',
            'filtres'  => 'array',
            'actif'    => 'boolean',
            'ordre'    => 'integer',
        ];
    }

    public function logements(): HasMany
    {
        return $this->hasMany(Logement::class, 'categorie_id');
    }

    public function scopeActives($query)
    {
        return $query->where('actif', true)->orderBy('ordre');
    }

    /** Une formule est-elle proposable dans cette catégorie ? */
    public function accepteFormule(string $formule): bool
    {
        return in_array($formule, $this->formules ?? [], true);
    }
}
