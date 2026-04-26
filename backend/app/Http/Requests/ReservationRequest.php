<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

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
            'tarif_id'     => 'required|exists:tarifs,id',
            'date_debut'   => 'required|date|after_or_equal:today',
            'date_fin'     => 'required|date|after_or_equal:date_debut',
            'nb_personnes' => 'required|integer|min:1',
        ];
    }
}
