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

    public function rules(): array
    {
        return [
            'nom'         => 'required|string|max:255',
            'description' => 'required|string',
            'adresse'     => 'required|string|max:255',
            'ville'       => 'required|string|max:100',
            'latitude'    => 'nullable|numeric|between:-90,90',
            'longitude'   => 'nullable|numeric|between:-180,180',
            'telephone'   => 'required|string|max:50',
        ];
    }
}
