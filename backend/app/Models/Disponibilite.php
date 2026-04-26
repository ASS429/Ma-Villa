<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Disponibilite extends Model
{
    protected $fillable = ['logement_id', 'date_debut', 'date_fin', 'disponible', 'motif'];

    protected function casts(): array
    {
        return [
            'date_debut' => 'date',
            'date_fin' => 'date',
            'disponible' => 'boolean',
        ];
    }

    public function logement(): BelongsTo
    {
        return $this->belongsTo(Logement::class);
    }
}
