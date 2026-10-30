<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Villa extends Model
{
    use HasFactory;
    protected $fillable = [
        'user_id', 'nom', 'description', 'adresse', 'ville', 'quartier',
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
            'majoration'      => 'float',
        ];
    }

    /**
     * Ni `majoration` ni `circuit` ne sont assignables en masse : ils fixent
     * qui reçoit l'argent. Ils ne se posent que par migration ou par la
     * console. Masqués aussi : le client n'a pas à lire notre part.
     */
    protected $hidden = ['majoration', 'circuit'];

    /** Le prix affiché comprend notre part, et l'argent va aux associés. */
    public function passeParLesAssocies(): bool
    {
        return $this->circuit === 'associe';
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
    /**
     * Une annonce non publiée ne se lit que par son propriétaire et l'admin.
     * Partagée par toutes les lectures publiques qui passent par la villa —
     * logements, prix, calendrier : la fiche cachée l'était aussi par là.
     */
    public function visiblePour(?User $user): bool
    {
        return $this->statut === 'validee'
            || ($user !== null && ($user->id === $this->user_id || $user->role === 'admin'));
    }

    /**
     * Ce qu'affiche une carte de villa : prix « à partir de » et son unité,
     * note, capacité, équipements. Le catalogue et les favoris montrent la
     * même carte ; les favoris s'en passaient, et chacun s'y lisait « Tarif
     * sur demande », sans note ni capacité.
     */
    public function scopePourCarte(Builder $query): Builder
    {
        // Les agrégats d'abord : ils posent `villas.*`, qu'un `addSelect` brut
        // remplacerait sinon par sa seule expression.
        return $query
            ->withMin('tarifs as prix_min', 'prix')
            ->withAvg('avis as note_moyenne', 'note')
            ->withCount('avis')
            ->withMax('logements as capacite_max', 'capacite')
            // Équipements affichés sur la carte de villa. Ils ne sont pas
            // stockés tels quels : ils se déduisent des logements et des
            // formules tarifaires, sans charger toute l'arborescence.
            // EXISTS plutôt qu'un SELECT 1 limité : ce dernier renvoyait `null`
            // en l'absence de résultat, si bien que le champ valait tantôt
            // true, tantôt null — jamais false. EXISTS renvoie toujours une
            // valeur, que le transtypage du modèle ramène à un booléen sur les
            // trois moteurs. L'alias vit dans le SQL : `addSelect` ne sait pas
            // nommer une expression brute par clé de tableau.
            ->addSelect(DB::raw(
                "(exists (select 1 from logements"
                ." where logements.villa_id = villas.id and logements.type = 'piscine'))"
                .' as a_piscine'
            ))
            ->addSelect(DB::raw(
                '(exists (select 1 from tarifs'
                .' inner join logements as l_clim on l_clim.id = tarifs.logement_id'
                .' where l_clim.villa_id = villas.id and tarifs.avec_clim = true))'
                .' as a_climatisation'
            ))
            ->addSelect([
                // Unité du tarif le moins cher : « à partir de 45 000 FCFA »
                // n'a pas le même sens à la nuitée qu'à la demi-journée.
                'prix_min_unite' => Tarif::select('tarifs.type_tarif')
                    ->join('logements as l_unite', 'l_unite.id', '=', 'tarifs.logement_id')
                    ->whereColumn('l_unite.villa_id', 'villas.id')
                    ->orderBy('tarifs.prix')
                    ->limit(1),
            ]);
    }

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
