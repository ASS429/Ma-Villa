<?php

namespace App\Http\Requests;

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
            'prix'        => 'required|numeric|min:0',
        ];
    }
}
