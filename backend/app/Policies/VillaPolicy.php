<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Villa;

class VillaPolicy
{
    public function update(User $user, Villa $villa): bool
    {
        return $user->id === $villa->user_id || $user->role === 'admin';
    }

    public function delete(User $user, Villa $villa): bool
    {
        return $user->id === $villa->user_id || $user->role === 'admin';
    }
}
