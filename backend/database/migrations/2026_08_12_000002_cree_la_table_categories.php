<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Une catégorie n'est pas une étiquette : c'est un triplet
 * **unité de prix + formules autorisées + jeu de filtres**.
 *
 * Tant que ces trois choses vivaient dans une énumération figée
 * (`villa_entiere`, `appartement`, `chambre`, `piscine`), ajouter « studio »
 * ou « hôtel » était une mise en production. Ici, c'est une ligne.
 *
 * Les durées (passe-temps, nuitée, week-end…) ne sont pas des catégories :
 * on loue une villa *pour* un week-end. Elles restent des formules tarifaires.
 * « Meublé » n'en est pas une non plus : en faire une doublerait chaque entrée.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('cle')->unique();
            $table->string('nom');
            $table->string('nom_pluriel');

            // Unité affichée sous le prix : « / nuitée » pour une villa,
            // « / mois » pour un studio. C'est ce qui change d'une catégorie
            // à l'autre, et rien d'autre sur la carte de résultat.
            $table->string('unite_prix')->default('nuitee');

            // Formules réellement proposables. Une piscine ne se loue pas au mois.
            $table->json('formules');

            // Filtres pertinents pour cette catégorie : afficher « nombre de
            // chambres » sur une piscine seule n'a pas de sens.
            $table->json('filtres')->nullable();

            $table->unsignedSmallInteger('ordre')->default(0);
            $table->boolean('actif')->default(true);
            $table->timestamps();
        });

        Schema::table('logements', function (Blueprint $table) {
            $table->foreignId('categorie_id')->nullable()->after('villa_id')
                  ->constrained('categories')->nullOnDelete();
            // Attribut, pas catégorie.
            $table->boolean('meuble')->default(true)->after('capacite');
            $table->index('categorie_id');
        });

        $maintenant = now();
        $categories = [
            ['villa', 'Villa', 'Villas', 'nuitee', ['nuitee','journee','demi_journee','pass'], ['chambres','capacite','piscine','climatisation']],
            ['appartement', 'Appartement', 'Appartements', 'nuitee', ['nuitee','journee','demi_journee','pass'], ['chambres','capacite','meuble','climatisation']],
            ['studio', 'Studio', 'Studios', 'mois', ['nuitee','pass'], ['capacite','meuble','climatisation']],
            ['chambre', 'Chambre', 'Chambres', 'nuitee', ['nuitee','journee'], ['capacite','climatisation']],
            ['piscine', 'Piscine seule', 'Piscines', 'journee', ['journee','demi_journee','pass'], ['capacite']],
            ['hotel', 'Hôtel', 'Hôtels', 'nuitee', ['nuitee'], ['capacite','climatisation','petit_dejeuner']],
            ['auberge', 'Auberge', 'Auberges', 'nuitee', ['nuitee','journee'], ['capacite','climatisation']],
        ];

        foreach ($categories as $i => [$cle, $nom, $pluriel, $unite, $formules, $filtres]) {
            DB::table('categories')->insert([
                'cle' => $cle, 'nom' => $nom, 'nom_pluriel' => $pluriel,
                'unite_prix' => $unite,
                'formules' => json_encode($formules),
                'filtres' => json_encode($filtres),
                'ordre' => $i, 'actif' => true,
                'created_at' => $maintenant, 'updated_at' => $maintenant,
            ]);
        }

        // Reprise des logements existants : sans cela, les annonces publiées
        // se retrouveraient sans catégorie et disparaîtraient de la recherche.
        $correspondances = [
            'villa_entiere' => 'villa',
            'appartement'   => 'appartement',
            'chambre'       => 'chambre',
            'piscine'       => 'piscine',
        ];

        foreach ($correspondances as $ancien => $nouveau) {
            $id = DB::table('categories')->where('cle', $nouveau)->value('id');
            DB::table('logements')->where('type', $ancien)->update(['categorie_id' => $id]);
        }
    }

    public function down(): void
    {
        Schema::table('logements', function (Blueprint $table) {
            $table->dropForeign(['categorie_id']);
            $table->dropColumn(['categorie_id', 'meuble']);
        });
        Schema::dropIfExists('categories');
    }
};
