<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Une demande de service d'un accompagnant (transport, repas).
 *
 * Elle ne réserve rien : elle trace qu'une famille a demandé, pour que personne
 * ne l'oublie si le message WhatsApp ne part pas. Depuis le 6 novembre 2026,
 * PasseTemps encaisse le service et reverse sa part au prestataire : l'équipe
 * l'enregistre ici, à la main (`encaissement`).
 */
class DemandeService extends Model
{
    protected $table = 'demandes_service';

    public const STATUTS = [
        'nouvelle'   => 'Nouvelle',
        'traitee'    => 'Traitée',
        'abandonnee' => 'Abandonnée',
    ];

    /**
     * D'où vient la demande : la page d'un service, ou la vitrine des JOJ.
     * C'est ce qui dira, après les Jeux, ce que la vitrine a réellement apporté.
     */
    public const ORIGINES = ['transport', 'restauration', 'joj'];

    /*
    | `statut`, `traitee_le` et `traitee_par` sont hors de `$fillable` : ils
    | appartiennent à l'administration. Un visiteur qui les enverrait ne doit
    | pas pouvoir créer une demande « déjà traitée », qui n'apparaîtrait dans
    | aucune file.
    */
    protected $fillable = [
        'user_id', 'prestation', 'date_service', 'heure', 'personnes', 'lieu',
        'latitude', 'longitude', 'precision_m',
        'vol', 'delegation', 'nom', 'telephone', 'email', 'message', 'langue',
        'origine',
    ];

    protected $appends = ['reference', 'libelle_prestation', 'repartition', 'encaissement', 'devis_lie'];

    /** Le détail vit dans `encaissement` ; les colonnes brutes n'apportent rien à l'écran. */
    protected $hidden = [
        'montant_encaisse', 'part_prestataire', 'prestataire', 'moyen_encaissement', 'reference_encaissement',
        'encaisse_le', 'encaisse_par', 'reverse_le', 'reference_reversement', 'reverse_par',
    ];

    protected function casts(): array
    {
        return [
            'date_service' => 'date:Y-m-d',
            'personnes'    => 'integer',
            'latitude'     => 'float',
            'longitude'    => 'float',
            'precision_m'  => 'integer',
            'traitee_le'   => 'datetime',
            'montant_encaisse' => 'integer',
            'part_prestataire' => 'integer',
            'encaisse_le'  => 'date:Y-m-d',
            'reverse_le'   => 'date:Y-m-d',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function traiteePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'traitee_par');
    }

    /** Les reçus du trajet : un par paiement enregistré, annulé compris (son numéro reste pris). */
    public function recus(): HasMany
    {
        return $this->hasMany(Reglement::class, 'demande_service_id');
    }

    /** Le devis établi depuis cette demande, s'il y en a un. */
    public function devis(): HasOne
    {
        return $this->hasOne(Devis::class, 'demande_service_id')->latestOfMany();
    }

    /**
     * Le devis lié, pour la console.
     *
     * @return array{id: int, numero: string, total: int, statut: string, pdf: string}|null
     */
    public function getDevisLieAttribute(): ?array
    {
        $devis = $this->devis;

        return $devis ? [
            'id' => $devis->id, 'numero' => $devis->numero, 'total' => (int) $devis->total,
            'statut' => $devis->statut, 'pdf' => $devis->urlPdf(),
        ] : null;
    }

    /** Encaissée et pas encore reversée : la part du prestataire est à lui, pas à nous. */
    public function scopeAReverser(Builder $query): Builder
    {
        return $query->whereNotNull('encaisse_le')->whereNull('reverse_le')->where('part_prestataire', '>', 0);
    }

    /**
     * L'argent de la demande, pour la console : null tant que le client n'a rien payé.
     *
     * @return array<string, mixed>|null
     */
    public function getEncaissementAttribute(): ?array
    {
        if ($this->encaisse_le === null) {
            return null;
        }

        $montant = (int) $this->montant_encaisse;
        $part = (int) $this->part_prestataire;
        // Le reçu valide de ce paiement : le dernier, puisqu'un paiement annulé garde le sien.
        $recu = $this->recus->where('statut', 'valide')->sortByDesc('id')->first();

        return [
            'montant'               => $montant,
            'part_prestataire'      => $part,
            'commission'            => $montant - $part,
            'prestataire'           => (string) $this->prestataire,
            'moyen'                 => (string) $this->moyen_encaissement,
            'libelle_moyen'         => Reglement::MOYENS[$this->moyen_encaissement] ?? (string) $this->moyen_encaissement,
            'reference'             => $this->reference_encaissement,
            'encaisse_le'           => $this->encaisse_le?->toDateString(),
            'reverse_le'            => $this->reverse_le?->toDateString(),
            'reference_reversement' => $this->reference_reversement,
            'recu'                  => $recu ? [
                'id' => $recu->id, 'numero' => $recu->numero, 'montant' => (int) $recu->montant,
                'client_nom' => $recu->client_nom, 'langue' => $recu->langue, 'pdf' => $recu->pdf,
                'demande_service_id' => $this->id,
            ] : null,
        ];
    }

    /** Ce qu'on cite au téléphone : court, et sans ambiguïté avec une réservation. */
    public function getReferenceAttribute(): string
    {
        return 'S-'.str_pad((string) $this->id, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Ce qui revient au prestataire et à nous, pour la console seulement : une demande ne
     * sort jamais vers le public. Rien quand la prestation n'a pas de prestataire attitré.
     *
     * @return array{prestataire: string, prix: int, prix_prestataire: int, commission: int}|null
     */
    public function getRepartitionAttribute(): ?array
    {
        $p = config("prestations.catalogue.{$this->prestation}");

        if (! $p || ! isset($p['prix_prestataire'])) {
            return null;
        }

        return [
            'prestataire'      => (string) ($p['prestataire'] ?? ''),
            'prix'             => (int) $p['prix_a_partir_de'],
            'prix_prestataire' => (int) $p['prix_prestataire'],
            'commission'       => (int) $p['prix_a_partir_de'] - (int) $p['prix_prestataire'],
        ];
    }

    /**
     * Le nom français de la prestation, pour la console.
     *
     * Une prestation retirée du catalogue garde sa clé plutôt que de disparaître :
     * la demande a existé, elle doit rester lisible.
     */
    public function getLibellePrestationAttribute(): string
    {
        return config("prestations.catalogue.{$this->prestation}.libelle.fr")
            ?? config("prestations.retirees.{$this->prestation}")
            ?? $this->prestation;
    }
}
