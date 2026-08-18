<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Abonnement d'un appareil aux notifications poussées.
 *
 * Les clés `p256dh` et `auth` servent à chiffrer la charge utile de bout en
 * bout : le service de poussée transporte le message sans pouvoir le lire.
 * Elles ne sortent donc jamais de l'API — d'où `$hidden`.
 */
class AbonnementPush extends Model
{
    protected $table = 'abonnements_push';

    protected $fillable = [
        'user_id', 'endpoint', 'cle_p256dh', 'cle_auth', 'expire_le', 'appareil',
    ];

    protected $hidden = ['endpoint', 'cle_p256dh', 'cle_auth'];

    protected function casts(): array
    {
        return [
            'expire_le' => 'datetime',
            'derniere_poussee_le' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Un abonnement que le navigateur a lui-même annoncé périmé. */
    public function estPerime(): bool
    {
        return $this->expire_le !== null && $this->expire_le->isPast();
    }
}
