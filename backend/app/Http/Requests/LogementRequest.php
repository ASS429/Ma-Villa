<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LogementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // `piscine` n'est plus proposée : on cesse donc de l'accepter à la
            // création. Les logements qui la portent déjà restent intacts —
            // c'est l'énumération en base qui les tient, pas cette règle.
            'type'        => 'required|in:villa_entiere,appartement,residence,chambre',
            'nom'         => 'required|string|max:255',
            'description' => 'nullable|string',
            'capacite'    => 'required|integer|min:1',
        ];
    }
}
