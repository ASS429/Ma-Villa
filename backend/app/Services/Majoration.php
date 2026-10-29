<?php

namespace App\Services;

use App\Models\Tarif;
use App\Models\Villa;
use Illuminate\Support\Facades\DB;

/**
 * Fait passer une annonce dans le circuit des associés (JOJ).
 *
 * Le prix affiché devient celui du propriétaire **plus** notre part —
 * 50 000 F demandés, 57 000 F affichés à 14 % — arrondi aux 500 F
 * supérieurs, pour qu'il se lise comme un prix et que le propriétaire ne
 * perde jamais un franc à l'arrondi. `Commission::pour()` retrouve ensuite
 * sa part exacte à partir du total payé.
 *
 * Les prix écrits dans la description (au mois, dégressifs) sont majorés de
 * la même façon : sans cela, le client lirait 50 000 dans le texte et
 * 57 000 dans la grille.
 */
class Majoration
{
    public static function prix(int|float|string $base, float $taux): int
    {
        return (int) (ceil(((float) $base) * (1 + $taux) / 500 - 1e-9) * 500);
    }

    /**
     * Les montants s'écrivent par groupes de trois chiffres (« 200 000 F »,
     * « 3 000 000 F le mois ») ; un nombre sans groupe — un étage, une
     * distance — n'est pas un prix, et un nombre sous 10 000 non plus.
     */
    public static function texte(?string $texte, float $taux): ?string
    {
        if ($texte === null) {
            return null;
        }

        return preg_replace_callback(
            '/(?<![\d])(\d{1,3})((?:[ \x{00A0}\x{202F}]\d{3})+)(?![\d])/u',
            function (array $m) use ($taux) {
                preg_match('/[ \x{00A0}\x{202F}]/u', $m[2], $sep);
                $valeur = (int) preg_replace('/\D/', '', $m[0]);

                return $valeur < 10000
                    ? $m[0]
                    : number_format(self::prix($valeur, $taux), 0, ',', $sep[0]);
            },
            $texte,
        );
    }

    /**
     * @return bool false si l'annonce y était déjà : on ne majore jamais deux fois.
     */
    public static function appliquer(Villa $villa, ?float $taux = null): bool
    {
        $taux ??= (float) config('paiement.associes.majoration');

        return DB::transaction(function () use ($villa, $taux) {
            $villa = Villa::whereKey($villa->id)->lockForUpdate()->first();

            if ($villa->majoration !== null) {
                return false;
            }

            $tarifs = Tarif::whereHas('logement', fn ($q) => $q->where('villa_id', $villa->id))->get();
            foreach ($tarifs as $tarif) {
                $tarif->update(array_filter([
                    'prix'         => self::prix($tarif->prix, $taux),
                    'prix_semaine' => $tarif->prix_semaine !== null ? self::prix($tarif->prix_semaine, $taux) : null,
                    'prix_mois'    => $tarif->prix_mois !== null ? self::prix($tarif->prix_mois, $taux) : null,
                ], fn ($v) => $v !== null));
            }

            $villa->forceFill([
                'description' => self::texte($villa->description, $taux),
                'majoration'  => $taux,
                'circuit'     => 'associe',
            ])->save();

            return true;
        });
    }
}
