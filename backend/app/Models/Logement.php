<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Logement extends Model
{
    protected $fillable = [
        'categorie_id', 'meuble','villa_id', 'type', 'nom', 'description', 'capacite', 'disponible'];

    protected $casts = ['disponible' => 'boolean'];

    /**
     * Le type historique et la catégorie disent la même chose, et seule la
     * seconde est interrogeable : `villa` porte l'unité de prix, les formules
     * et les filtres, et c'est `categorie_id` que la recherche joint.
     *
     * Une seule clé ne porte pas le nom de son type — les autres sont
     * identiques des deux côtés.
     */
    private const TYPE_PAR_CATEGORIE = ['villa' => 'villa_entiere'];

    public static function typePour(string $cle): string
    {
        return self::TYPE_PAR_CATEGORIE[$cle] ?? $cle;
    }

    public static function categoriePour(string $type): string
    {
        return array_flip(self::TYPE_PAR_CATEGORIE)[$type] ?? $type;
    }

    /**
     * Les deux colonnes ne divergent jamais, quel que soit le chemin d'écriture.
     *
     * ⚠️ `categorie_id` n'était renseigné par **personne** : seule la migration
     * du 12 août 2026 l'avait rempli pour l'existant, et `LogementRequest` ne
     * l'a jamais accepté. Toute annonce créée depuis avait donc une catégorie
     * nulle — et la recherche joint là-dessus. Les dix annonces publiées étaient
     * invisibles derrière chacun des sept filtres, constaté le 23 septembre.
     *
     * Ici et non dans la requête : l'application mobile déjà distribuée écrit
     * par la même API avec `type` seul, les tests passent par la fabrique, et un
     * futur client passera encore ailleurs. Même leçon que la normalisation des
     * villes, qu'on avait justement sortie du formulaire.
     */
    protected static function booted(): void
    {
        static::saving(function (self $logement) {
            // Celle des deux qui vient d'être posée l'emporte : changer le type
            // d'un logement existant doit déplacer sa catégorie, et inversement.
            $parLaCategorie = $logement->isDirty('categorie_id')
                ? true
                : ($logement->isDirty('type') ? false : $logement->categorie_id !== null);

            if ($parLaCategorie && $logement->categorie_id !== null) {
                // La catégorie fait foi : le type historique la suit, pour les
                // lecteurs qui ne connaissent que lui — l'APK, notamment.
                $cle = Categorie::whereKey($logement->categorie_id)->value('cle');

                if ($cle !== null) {
                    $logement->type = self::typePour($cle);
                }

                return;
            }

            if ($logement->type !== null) {
                $logement->categorie_id = Categorie::where('cle', self::categoriePour($logement->type))->value('id');
            }
        });
    }

    public function categorie(): BelongsTo
    {
        return $this->belongsTo(Categorie::class);
    }

    public function villa(): BelongsTo
    {
        return $this->belongsTo(Villa::class);
    }

    public function tarifs(): HasMany
    {
        return $this->hasMany(Tarif::class);
    }

    public function disponibilites(): HasMany
    {
        return $this->hasMany(Disponibilite::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    public function photos(): MorphMany
    {
        return $this->morphMany(Photo::class, 'photoable')->orderBy('ordre');
    }
}
