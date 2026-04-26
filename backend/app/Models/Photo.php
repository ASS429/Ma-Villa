<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Photo extends Model
{
    protected $fillable = ['photoable_id', 'photoable_type', 'url', 'alt', 'ordre'];

    public function photoable(): MorphTo
    {
        return $this->morphTo();
    }
}
