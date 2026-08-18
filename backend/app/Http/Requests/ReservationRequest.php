<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReservationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'client';
    }

    public function rules(): array
    {
        return [
            'logement_id'  => 'required|exists:logements,id',
            // Le tarif doit être une des formules du logement réservé. Sans ce
            // rattachement, n'importe quel identifiant de tarif était accepté :
            // le client envoyait celui du logement le moins cher de la
            // plateforme et réservait la villa la plus chère à ce prix-là.
            'tarif_id'     => [
                'required',
                Rule::exists('tarifs', 'id')->where('logement_id', $this->input('logement_id')),
            ],
            'date_debut'   => 'required|date|after_or_equal:today',
            'date_fin'     => 'required|date|after_or_equal:date_debut',
            'nb_personnes' => 'required|integer|min:1',
        ];
    }

    public function messages(): array
    {
        return [
            'tarif_id.exists' => 'Cette formule tarifaire ne correspond pas au logement choisi.',
        ];
    }
}
