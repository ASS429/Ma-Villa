<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un remboursement enregistré — le pendant sortant des reversements.
 *
 * Comme eux, il **constate** un mouvement fait ailleurs : le virement de
 * retour se passe chez le prestataire tant que le déboursement n'est pas
 * ouvert. Ce qui est ici sert à trois choses que le tableau de bord PayDunya
 * ne fait pas : retrancher du chiffre d'affaires, garder le motif, et savoir
 * ce qu'un propriétaire déjà payé doit rendre.
 *
 * ⚠️ `montant` est hors de `$fillable` **volontairement**, comme pour les
 * reversements : une somme dictée par le navigateur est une écriture
 * comptable dictée par le navigateur. Elle se pose explicitement, après
 * calcul côté serveur.
 */
class Remboursement extends Model
{
    protected $fillable = [
        'paiement_id', 'reservation_id', 'impute_a', 'commission_rendue',
        'motif', 'reference', 'cree_par', 'createur_nom',
    ];

    protected function casts(): array
    {
        return [
            'montant' => 'decimal:2',
            'a_recuperer_proprietaire' => 'decimal:2',
            'commission_rendue' => 'boolean',
        ];
    }

    /** À qui l'annulation est imputable, et ce que cela change. */
    public const IMPUTATIONS = [
        'plateforme'   => 'La plateforme',
        'proprietaire' => 'Le propriétaire',
        'client'       => 'Le client',
    ];

    public function paiement(): BelongsTo
    {
        return $this->belongsTo(Paiement::class);
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    public function auteur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cree_par');
    }
}
