<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Avis extends Model
{
    protected $fillable = ['user_id', 'villa_id', 'note', 'commentaire'];

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function villa(): BelongsTo
    {
        return $this->belongsTo(Villa::class);
    }
}
