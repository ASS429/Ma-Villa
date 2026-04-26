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
            'type'        => 'required|in:villa_entiere,appartement,chambre,piscine',
            'nom'         => 'required|string|max:255',
            'description' => 'nullable|string',
            'capacite'    => 'required|integer|min:1',
        ];
    }
}
