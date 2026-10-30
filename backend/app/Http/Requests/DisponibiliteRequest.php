<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DisponibiliteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Une plage n'a d'effet que fermée : la réservation et la recherche ne
     * lisent que celles-là. La colonne vaut « ouverte » par défaut, si bien
     * qu'une demande sans ce champ créait une ligne qui ne bloquait rien.
     */
    protected function prepareForValidation(): void
    {
        if (! $this->has('disponible')) {
            $this->merge(['disponible' => false]);
        }
    }

    public function rules(): array
    {
        return [
            'date_debut'  => 'required|date|after_or_equal:today',
            // Les deux bornes sont incluses, comme pour une réservation : fermer
            // un seul jour, c'est fermer du 10 au 10.
            'date_fin'    => 'required|date|after_or_equal:date_debut',
            'disponible'  => 'boolean',
            'motif'       => 'nullable|string|max:255',
        ];
    }

    public function messages(): array
    {
        return [
            'date_debut.after_or_equal' => 'On ne ferme pas une date déjà passée.',
            'date_fin.after_or_equal'   => 'La fin ne peut pas précéder le début.',
        ];
    }
}
