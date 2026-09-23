<?php

use App\Models\Logement;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Reclasse les quatre annonces que leur propriétaire n'a pas pu classer.
 *
 * ## Pourquoi elles étaient fausses
 *
 * Le formulaire de publication ne proposait que quatre types : villa entière,
 * appartement, résidence, chambre. Ni studio, ni hôtel, ni auberge — ouverts
 * seulement par la migration précédente. Un propriétaire d'auberge a donc dû
 * prendre le voisin le moins faux, et deux annonces nommées « Auberge » se
 * sont retrouvées l'une en chambre, l'autre en villa entière.
 *
 * La migration précédente a rempli `categorie_id` depuis le `type` : elle a
 * donc fidèlement recopié ces approximations. Elle ne pouvait rien faire de
 * mieux — l'information n'avait jamais été saisie.
 *
 * ## Pourquoi une migration, et pourquoi ces quatre-là seulement
 *
 * Décidé par l'exploitant le 23 septembre 2026, après lui avoir soumis le
 * tableau : « reclasse-les ». La correction se lit sur le **nom** de l'annonce,
 * ce qu'aucune règle automatique ne saurait faire sans risquer de se tromper
 * sur les suivantes. C'est donc un geste ponctuel et daté, pas une règle.
 *
 * ⚠️ Chaque correction est **conditionnée au nom** autant qu'à l'identifiant :
 * sur une base neuve — un poste de développement, la base de test — ces
 * identifiants désignent autre chose, ou rien. La migration n'y touche alors à
 * rien, et c'est voulu.
 */
return new class extends Migration
{
    /**
     * L'ancien type est inscrit ici : c'est ce qui rend le geste réversible.
     * Sans lui, `down()` ne saurait pas quoi remettre.
     */
    private const CORRECTIONS = [
        ['villa' => 46, 'nom' => 'Auberge',           'avant' => 'chambre',       'cle' => 'auberge'],
        ['villa' => 31, 'nom' => 'Halima auberge',    'avant' => 'villa_entiere', 'cle' => 'auberge'],
        ['villa' => 42, 'nom' => 'Résidence Boncoin', 'avant' => 'chambre',       'cle' => 'residence'],
        ['villa' => 34, 'nom' => 'Studio meublé',     'avant' => 'appartement',   'cle' => 'studio'],
    ];

    public function up(): void
    {
        foreach (self::CORRECTIONS as $correction) {
            $this->ranger($correction, $correction['cle']);
        }
    }

    public function down(): void
    {
        foreach (self::CORRECTIONS as $correction) {
            $this->ranger($correction, Logement::categoriePour($correction['avant']));
        }
    }

    private function ranger(array $correction, string $cle): void
    {
        $villa = DB::table('villas')
            ->where('id', $correction['villa'])
            ->where('nom', $correction['nom'])
            ->first();

        if ($villa === null) {
            return;
        }

        $id = DB::table('categories')->where('cle', $cle)->value('id');

        if ($id === null) {
            return;
        }

        // Les deux colonnes ensemble : le modèle les tient à l'écriture, mais
        // une requête directe ne passe pas par lui.
        DB::table('logements')->where('villa_id', $villa->id)->update([
            'categorie_id' => $id,
            'type'         => Logement::typePour($cle),
            'updated_at'   => now(),
        ]);
    }
};
