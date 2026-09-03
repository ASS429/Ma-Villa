<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Villa extends Model
{
    use HasFactory;
    protected $fillable = [
        'user_id', 'nom', 'description', 'adresse', 'ville',
        'latitude', 'longitude', 'telephone', 'statut', 'vedette',
    ];

    protected $attributes = [
        'statut'  => 'en_attente',
        'vedette' => false,
    ];

    /**
     * `vedette` remontait en entier 0/1 faute de transtypage. Côté React,
     * `{villa.vedette && <Badge/>}` affichait alors un « 0 » sur chaque carte
     * non mise en avant — JSX rend le nombre zéro, pas le vide.
     *
     * `a_piscine` et `a_climatisation` sont calculés par sous-requête dans
     * VillaController : ils arrivent à 1 ou null selon le moteur.
     */
    protected function casts(): array
    {
        return [
            'vedette'         => 'boolean',
            'a_piscine'       => 'boolean',
            'a_climatisation' => 'boolean',
            'latitude'        => 'float',
            'longitude'       => 'float',
        ];
    }

    /**
     * Retire le numéro de la villa des résultats.
     *
     * Publié, il permet d'appeler le propriétaire et de convenir d'un séjour
     * hors plateforme : la commission s'évapore, et la réservation n'est plus
     * tracée — donc ni avis vérifié, ni recours en cas de litige. Il n'a de
     * toute façon aucun usage sur une carte de résultat.
     *
     * Retiré du SELECT plutôt que masqué à la sérialisation : ce qui n'est
     * jamais lu ne peut pas fuiter par un autre chemin.
     */
    public function scopeWithoutTelephone(Builder $query): Builder
    {
        $colonnes = array_diff(
            Schema::getColumnListing($this->getTable()),
            ['telephone']
        );

        return $query->select(array_map(fn ($c) => "{$this->getTable()}.{$c}", $colonnes));
    }

    /**
     * Ce qu'il manque au brouillon, dit par étape.
     *
     * Chaque entrée porte l'étape concernée : l'écran sait alors où renvoyer,
     * ce qu'une liste de champs ne permettrait pas — « tarif_id manquant » ne
     * dit pas quoi faire.
     *
     * Vit sur le modèle et non dans le contrôleur de publication, parce que
     * l'administration en a besoin aussi : un brouillon qui traîne est un
     * propriétaire bloqué, et savoir **sur quoi** il bloque est la seule
     * chose qui permette de le débloquer d'un appel.
     */
    public function ceQuiManque(): array
    {
        $manques = [];

        if (blank($this->adresse)) {
            $manques[] = ['etape' => 'adresse', 'message' => "L'adresse du logement n'est pas renseignée."];
        }

        if (blank($this->telephone)) {
            $manques[] = ['etape' => 'adresse', 'message' => 'Aucun numéro ne permet de vous joindre.'];
        }

        if (blank($this->description)) {
            $manques[] = ['etape' => 'description', 'message' => "L'annonce n'a pas de description."];
        }

        $logement = $this->logements()->withCount('tarifs')->first();

        if (! $logement) {
            $manques[] = ['etape' => 'logement', 'message' => "Aucun logement n'a été décrit."];
        } elseif ($logement->tarifs_count === 0) {
            $manques[] = ['etape' => 'prix', 'message' => 'Aucun tarif n\'a été fixé.'];
        }

        return $manques;
    }

    public function proprietaire(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function logements(): HasMany
    {
        return $this->hasMany(Logement::class);
    }

    /**
     * Tous les tarifs de la villa, à travers ses logements.
     * Permet d'agréger le prix le plus bas sans charger toute l'arborescence.
     */
    public function tarifs(): HasManyThrough
    {
        return $this->hasManyThrough(Tarif::class, Logement::class);
    }

    public function photos(): MorphMany
    {
        return $this->morphMany(Photo::class, 'photoable')->orderBy('ordre');
    }

    public function avis(): HasMany
    {
        return $this->hasMany(Avis::class);
    }

    public function favoris(): HasMany
    {
        return $this->hasMany(Favori::class);
    }
}
