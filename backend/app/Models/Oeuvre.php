<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * Une œuvre de la boutique.
 *
 * Ma Villa est le seul vendeur : l'artiste est une information portée par
 * l'œuvre, pas un compte. Voir la migration pour les trois arbitrages.
 */
class Oeuvre extends Model
{
    protected $fillable = [
        'titre', 'artiste', 'description', 'technique', 'dimensions',
        'annee', 'prix', 'statut', 'vedette',
    ];

    protected function casts(): array
    {
        return [
            'prix'    => 'integer',
            'annee'   => 'integer',
            'vedette' => 'boolean',
        ];
    }

    public function photos(): MorphMany
    {
        return $this->morphMany(Photo::class, 'photoable')->orderBy('ordre');
    }

    public function commandes(): HasMany
    {
        return $this->hasMany(Commande::class);
    }

    /**
     * Ce qui est visible du public.
     *
     * Une œuvre vendue **reste visible** : la fiche est indexée, et une galerie
     * qui efface ce qu'elle a vendu perd la preuve qu'elle vend. Seul le
     * brouillon est caché.
     */
    public function scopeVisible(Builder $query): Builder
    {
        return $query->whereIn('statut', ['publiee', 'vendue']);
    }

    /** Ce qui peut encore être acheté. */
    public function scopeAchetable(Builder $query): Builder
    {
        return $query->where('statut', 'publiee');
    }

    public function estAchetable(): bool
    {
        return $this->statut === 'publiee';
    }
}
