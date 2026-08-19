<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Un versement effectué à un propriétaire.
 *
 * L'enregistrement, pas le mouvement de fonds : voir la migration.
 */
class Reversement extends Model
{
    protected $fillable = [
        'user_id', 'beneficiaire_nom', 'beneficiaire_telephone',
        'montant', 'methode', 'statut', 'reference', 'note', 'verse_le',
        'disburse_token', 'disburse_id', 'transaction_id', 'provider_ref',
        'echec_motif', 'reponse_prestataire',
        'cree_par', 'createur_nom',
    ];

    protected function casts(): array
    {
        return [
            'montant'             => 'decimal:2',
            'verse_le'            => 'datetime',
            'reponse_prestataire' => 'array',
        ];
    }

    /**
     * La réponse brute du prestataire peut contenir des identifiants internes
     * et ne regarde que l'administration. Le propriétaire lit son montant, sa
     * date et sa référence — pas le détail d'une intégration.
     */
    protected $hidden = ['reponse_prestataire'];

    /** Versé pour de bon : à la main, ou par un déboursement abouti. */
    public function estRegle(): bool
    {
        return in_array($this->statut, ['manuel', 'reussi'], true);
    }

    public function beneficiaire(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function paiements(): HasMany
    {
        return $this->hasMany(Paiement::class);
    }

    /** Libellés d'affichage, côté serveur : les deux consoles les partagent. */
    public const STATUTS = [
        'manuel'   => 'Versé à la main',
        'en_cours' => 'En cours',
        'reussi'   => 'Versé',
        'echoue'   => 'Échoué',
    ];

    public const METHODES = [
        'wave'         => 'Wave',
        'orange_money' => 'Orange Money',
        'free_money'   => 'Free Money',
        'virement'     => 'Virement bancaire',
        'especes'      => 'Espèces',
    ];
}
