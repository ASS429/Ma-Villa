<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tarif extends Model
{
    protected $fillable = ['logement_id', 'type_tarif', 'avec_clim', 'avec_buffet', 'prix'];

    protected function casts(): array
    {
        return [
            'avec_clim' => 'boolean',
            'avec_buffet' => 'boolean',
            'prix' => 'decimal:2',
        ];
    }

    public function logement(): BelongsTo
    {
        return $this->belongsTo(Logement::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }
}
