<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
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

    public function proprietaire(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function logements(): HasMany
    {
        return $this->hasMany(Logement::class);
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
