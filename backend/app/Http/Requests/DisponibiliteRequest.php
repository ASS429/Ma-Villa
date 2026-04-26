<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DisponibiliteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'date_debut'  => 'required|date|after_or_equal:today',
            'date_fin'    => 'required|date|after:date_debut',
            'disponible'  => 'boolean',
            'motif'       => 'nullable|string|max:255',
        ];
    }
}
