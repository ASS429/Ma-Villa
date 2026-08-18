<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Log;

/**
 * Trace d'une action d'administration.
 *
 * Le nom et l'adresse de l'auteur sont **recopiés**, pas seulement reliés :
 * un compte supprimé ne doit pas effacer la trace de ce qu'il a fait. Un
 * journal qui disparaît avec son auteur ne prouve rien.
 */
class JournalAdmin extends Model
{
    protected $table = 'journal_admin';

    protected $fillable = [
        'user_id', 'auteur_nom', 'auteur_email',
        'action', 'cible_type', 'cible_id', 'cible_libelle', 'details', 'ip',
    ];

    protected function casts(): array
    {
        return ['details' => 'array'];
    }

    public function auteur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Consigne une action.
     *
     * N'échoue jamais : une écriture de journal qui casserait la validation
     * d'une villa transformerait une mesure de traçabilité en panne. Un échec
     * part dans les logs applicatifs, et l'action métier se poursuit.
     *
     * @param  array<string, mixed>  $details
     */
    public static function consigner(
        ?User $auteur,
        string $action,
        ?Model $cible = null,
        ?string $libelle = null,
        array $details = [],
        ?string $ip = null,
    ): void {
        try {
            static::create([
                'user_id' => $auteur?->id,
                'auteur_nom' => $auteur?->name ?? 'inconnu',
                'auteur_email' => $auteur?->email ?? 'inconnu',
                'action' => $action,
                'cible_type' => $cible ? class_basename($cible) : null,
                'cible_id' => $cible?->getKey(),
                'cible_libelle' => $libelle,
                'details' => $details ?: null,
                'ip' => $ip,
            ]);
        } catch (\Throwable $e) {
            Log::error('Journal d\'audit non écrit', [
                'action' => $action,
                'erreur' => $e->getMessage(),
            ]);
        }
    }
}
