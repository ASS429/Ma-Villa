<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Une commande d'article.
 *
 * Un article par commande : une pièce est unique, l'exemplaire vendu ne peut
 * plus l'être. Le titre, l'artiste et le prix sont recopiés à la commande —
 * un changement de prix ne doit jamais réécrire une vente passée.
 */
class Commande extends Model
{
    protected $fillable = [
        'user_id', 'oeuvre_id',
        'oeuvre_titre', 'oeuvre_artiste', 'montant_oeuvre',
        'zone_livraison', 'frais_livraison', 'montant_total',
        'destinataire', 'telephone', 'adresse', 'ville', 'note',
        'mode_paiement', 'statut_paiement', 'statut',
        'reference', 'token_paydunya', 'url_paiement', 'url_application',
        'reponse_prestataire', 'paye_le', 'expediee_le', 'livree_le',
    ];

    protected function casts(): array
    {
        return [
            'montant_oeuvre'      => 'integer',
            'frais_livraison'     => 'integer',
            'montant_total'       => 'integer',
            'reponse_prestataire' => 'array',
            'paye_le'             => 'datetime',
            'expediee_le'         => 'datetime',
            'livree_le'           => 'datetime',
        ];
    }

    /**
     * Le jeton de facture identifie la transaction chez le prestataire : qui le
     * détient peut agir dessus. La réponse brute peut porter des données du
     * payeur. Ni l'un ni l'autre n'a sa place dans une réponse d'API.
     */
    protected $hidden = ['token_paydunya', 'reponse_prestataire'];

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function oeuvre(): BelongsTo
    {
        return $this->belongsTo(Oeuvre::class);
    }

    /**
     * Une commande qui immobilise l'article.
     *
     * Une commande annulée la libère ; toutes les autres la retiennent, y
     * compris une commande à régler à la livraison qui n'a rien encaissé.
     * C'est voulu : l'acheteur s'est engagé, et vendre deux fois la même
     * toile est le seul incident qu'une galerie ne peut pas rattraper.
     */
    public function scopeImmobilisante(Builder $query): Builder
    {
        return $query->where('statut', '!=', 'annulee');
    }

    public function estReglee(): bool
    {
        return $this->statut_paiement === 'reussi'
            || ($this->mode_paiement === 'livraison' && $this->statut === 'livree');
    }

    /** Reste-t-il quelque chose à payer en ligne ? */
    public function attendUnReglement(): bool
    {
        return $this->mode_paiement === 'en_ligne'
            && $this->statut_paiement !== 'reussi'
            && $this->statut !== 'annulee';
    }

    public const STATUTS = [
        'en_attente' => 'En attente',
        'confirmee'  => 'Confirmée',
        'expediee'   => 'Expédiée',
        'livree'     => 'Livrée',
        'annulee'    => 'Annulée',
    ];

    public const MODES = [
        'en_ligne'  => 'Payé en ligne',
        'livraison' => 'Paiement à la livraison',
    ];
}
