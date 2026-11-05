<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Une demande de devis que le site a dû refuser : dates prises, séjour trop court,
 * trop de monde, logement retiré. Sans elle, le pilotage ne voyait que ce qui avait
 * abouti, jamais la demande qu'on n'avait pas pu servir.
 *
 * **Aucune donnée personnelle** : ni nom, ni numéro, ni adresse IP. Le nom et le
 * téléphone tapés dans le formulaire ne sont pas gardés : le client n'a rien obtenu,
 * et la politique de confidentialité ne lui annonce rien de tel.
 *
 * L'adresse IP ne sert qu'à ne compter qu'une fois celui qui réessaie les mêmes
 * dates ; son empreinte vit six heures dans le cache, jamais en base.
 */
class DevisRefuse extends Model
{
    protected $table = 'devis_refuses';

    public const UPDATED_AT = null;

    public const MOTIFS = [
        'dates_prises'  => 'Dates déjà prises',
        'trop_court'    => 'Séjour trop court',
        'trop_de_monde' => 'Trop de personnes',
        'retire'        => 'Logement retiré',
    ];

    protected $fillable = ['villa_id', 'logement_id', 'motif', 'date_debut', 'date_fin', 'personnes', 'langue'];

    protected function casts(): array
    {
        return [
            'date_debut' => 'date:Y-m-d',
            'date_fin'   => 'date:Y-m-d',
            'personnes'  => 'integer',
        ];
    }

    /**
     * Note le refus. Un compteur en panne ne doit jamais changer la réponse faite
     * au client : l'erreur part dans les journaux, et le refus suit son cours.
     *
     * @param  array<string, mixed>  $demande  les champs validés de la demande
     */
    public static function noter(Request $request, Logement $logement, string $motif, array $demande): void
    {
        try {
            $empreinte = sha1(implode('|', [
                $request->ip(), $logement->id, $motif, $demande['date_debut'], $demande['date_fin'],
            ]));

            if (! Cache::add("devis-refuse:{$empreinte}", 1, now()->addHours(6))) {
                return;
            }

            self::create([
                'villa_id'    => $logement->villa_id,
                'logement_id' => $logement->id,
                'motif'       => $motif,
                'date_debut'  => $demande['date_debut'],
                'date_fin'    => $demande['date_fin'],
                'personnes'   => $demande['nb_personnes'],
                'langue'      => $demande['langue'] ?? 'fr',
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
