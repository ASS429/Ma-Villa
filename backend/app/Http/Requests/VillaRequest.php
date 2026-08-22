<?php

namespace App\Http\Requests;

use App\Models\Villa;
use Illuminate\Foundation\Http\FormRequest;

class VillaRequest extends FormRequest
{
    public function authorize(): bool
    {
        if ($this->user()?->role !== 'proprietaire') {
            return false;
        }

        $villa = $this->route('villa');
        if ($villa instanceof Villa) {
            return $this->user()->id === $villa->user_id;
        }

        return true;
    }

    /**
     * Seuls le nom et la ville sont exigés ici.
     *
     * Ce n'est pas un relâchement : la vérification n'a pas disparu, elle
     * s'est **déplacée à la publication** (`VillaController::publier`). Une
     * annonce incomplète existe désormais comme brouillon — invisible du
     * public et absente de la file de modération — et rien d'incomplet ne
     * peut être soumis.
     *
     * L'ancien formulaire exigeait tout d'un coup. Un propriétaire qui
     * s'arrêtait au milieu perdait sa saisie, et on ne le revoyait pas : la
     * perte ne se mesure nulle part, puisque personne ne vient se plaindre
     * d'une annonce qu'il n'a pas créée.
     */
    public function rules(): array
    {
        return [
            'nom'         => 'required|string|max:255',
            'ville'       => 'required|string|max:100',
            'description' => 'sometimes|nullable|string',
            'adresse'     => 'sometimes|nullable|string|max:255',
            'latitude'    => 'nullable|numeric|between:-90,90',
            'longitude'   => 'nullable|numeric|between:-180,180',
            'telephone'   => 'sometimes|nullable|string|max:50',
        ];
    }
}
