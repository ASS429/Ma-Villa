<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * Un article de la boutique.
 *
 * Ma Villa est le seul vendeur : l'artiste est une information portée par
 * l'article, pas un compte. Voir la migration pour les trois arbitrages.
 */
class Oeuvre extends Model
{
    protected $fillable = [
        'titre', 'artiste', 'categorie', 'description', 'technique', 'dimensions',
        'annee', 'prix', 'stock', 'statut', 'vedette',
    ];

    protected function casts(): array
    {
        return [
            'prix'    => 'integer',
            'stock'   => 'integer',
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
     * Un article vendu **reste visible** : la fiche est indexée, et une galerie
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

    public function scopeDeCategorie(Builder $query, string $categorie): Builder
    {
        return $query->where('categorie', $categorie);
    }

    /**
     * Publiée **et** encore en stock.
     *
     * Le premier catalogue supposait des pièces uniques ; les articles réels
     * sont pour la plupart reproductibles. Sans la quantité, commander un
     * bracelet aurait fait disparaître les bracelets.
     */
    public function estAchetable(): bool
    {
        return $this->statut === 'publiee' && $this->stock > 0;
    }

    /** Le libellé de sa catégorie, ou la clé brute si elle a disparu. */
    public function nomDeCategorie(): string
    {
        return config("boutique.categories.{$this->categorie}.nom", $this->categorie);
    }
}
