<?php

namespace App\Http\Requests;

use App\Services\PrixSejour;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

class TarifRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type_tarif'  => 'required|in:journee,nuitee,demi_journee,pass',
            'avec_clim'   => 'boolean',
            'avec_buffet' => 'boolean',
            'prix'        => 'required|numeric|min:'.(int) config('annonces.prix_minimum'),

            /*
             | Les longs séjours, seulement sur une nuitée : une semaine de
             | demi-journées ne veut rien dire. Facultatifs — l'application
             | mobile déjà distribuée ne les envoie pas.
             |
             | Plafonnés à 7 et 30 nuits : un prix de semaine plus cher que sept
             | nuits ne serait jamais appliqué (`PrixSejour` prend le moins
             | cher), mais il s'afficherait sur la fiche comme une offre.
             */
            'prix_semaine' => ['nullable', 'integer', 'min:'.(int) config('annonces.prix_minimum'), 'prohibited_unless:type_tarif,nuitee', $this->auPlus(PrixSejour::NUITS_SEMAINE, 'la semaine')],
            'prix_mois'    => ['nullable', 'integer', 'min:'.(int) config('annonces.prix_minimum'), 'prohibited_unless:type_tarif,nuitee', $this->auPlus(PrixSejour::NUITS_MOIS, 'le mois')],
        ];
    }

    public function messages(): array
    {
        return [
            'prix.min' => 'Un prix commence à :min FCFA : vérifiez qu’il ne manque pas de zéros.',
            'prix_semaine.min' => 'Un prix commence à :min FCFA : vérifiez qu’il ne manque pas de zéros.',
            'prix_mois.min' => 'Un prix commence à :min FCFA : vérifiez qu’il ne manque pas de zéros.',
            'prix_semaine.prohibited_unless' => 'Un prix à la semaine ne se pose que sur une nuitée.',
            'prix_mois.prohibited_unless'    => 'Un prix au mois ne se pose que sur une nuitée.',
        ];
    }

    private function auPlus(int $nuits, string $periode): Closure
    {
        return function (string $attribut, mixed $valeur, Closure $echec) use ($nuits, $periode) {
            $prix = (float) $this->input('prix');
            if ($prix > 0 && (float) $valeur > $prix * $nuits) {
                $echec("Le prix pour {$periode} doit rester sous {$nuits} nuits à l’unité, sinon il ne serait jamais appliqué.");
            }
        };
    }
}
