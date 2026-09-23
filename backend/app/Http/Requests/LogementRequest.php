<?php

namespace App\Http\Requests;

use App\Models\Categorie;
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
            /*
             | La **catégorie** est ce qui se cherche : c'est elle que la
             | recherche joint, et elle porte l'unité de prix, les formules et
             | les filtres. Le type historique la suit, tenu par le modèle.
             |
             | Elle n'était acceptée nulle part, et `categorie_id` restait donc
             | nul sur toute annonce créée depuis le 12 août — invisible
             | derrière chacun des sept filtres.
             */
            'categorie'   => 'nullable|string|exists:categories,cle',

            /*
             | Le type reste accepté, et reste obligatoire quand la catégorie
             | manque : **l'application mobile déjà distribuée l'envoie**, avec
             | un code qu'on ne peut plus mettre à jour.
             |
             | `piscine` n'est plus proposée : on cesse de l'accepter à la
             | création. Les logements qui la portent restent intacts — c'est
             | l'énumération en base qui les tient, pas cette règle.
             */
            'type'        => 'required_without:categorie|in:villa_entiere,appartement,residence,studio,chambre,hotel,auberge',
            'nom'         => 'required|string|max:255',
            'description' => 'nullable|string',
            'capacite'    => 'required|integer|min:1',
        ];
    }

    /**
     * Les attributs prêts à écrire : la clé de catégorie devient sa clé
     * étrangère, et ne traverse pas l'affectation de masse — `categorie` n'est
     * pas une colonne, elle serait ignorée en silence.
     */
    public function donnees(): array
    {
        $donnees = $this->validated();

        if (filled($donnees['categorie'] ?? null)) {
            $donnees['categorie_id'] = Categorie::where('cle', $donnees['categorie'])->value('id');
        }

        unset($donnees['categorie']);

        return $donnees;
    }
}
