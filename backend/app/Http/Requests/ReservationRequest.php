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
            // Une demande non payée bloque le calendrier jusqu'à la réponse du
            // propriétaire : sans borne, une seule demande gratuite pouvait
            // fermer un logement pour des années. Six mois couvrent la plus
            // longue location meublée, dix-huit mois la plus lointaine.
            'date_debut'   => 'required|date|after_or_equal:today|before_or_equal:'.now()->addMonths(18)->toDateString(),
            // strtotime plutôt que Carbon : une date illisible doit finir en
            // erreur de validation, pas en exception.
            'date_fin'     => 'required|date|after_or_equal:date_debut|before_or_equal:'
                .date('Y-m-d', strtotime('+183 days', strtotime((string) $this->input('date_debut')) ?: time())),
            'nb_personnes' => 'required|integer|min:1',
        ];
    }

    public function messages(): array
    {
        return [
            'tarif_id.exists' => 'Cette formule tarifaire ne correspond pas au logement choisi.',
            'date_debut.before_or_equal' => 'Les réservations s’ouvrent jusqu’à dix-huit mois à l’avance.',
            'date_fin.before_or_equal'   => 'Un séjour dure six mois au plus.',
        ];
    }
}
