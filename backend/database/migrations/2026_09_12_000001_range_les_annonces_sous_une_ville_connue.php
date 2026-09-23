<?php

use App\Services\Ville;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Range les annonces existantes sous une ville connue.
 *
 * Six annonces publiées, six « destinations » : Saly, Saly bambara, Saly
 * velingara, Saly derrière rdc, Mbour Saly, Dakar. Cinq d'entre elles
 * désignent le même endroit, et l'accueil les proposait comme cinq lieux
 * différents — chacun menant à une page d'une seule annonce.
 *
 * Rien n'est effacé : ce qui dépasse la ville passe dans `quartier`, que le
 * propriétaire garde et peut corriger. La ville, elle, redevient commune à
 * toutes les annonces du même lieu.
 *
 * ⚠️ Une migration plutôt qu'une commande : c'est le seul mécanisme qui
 * s'exécute de lui-même au déploiement, et il laisse une trace datée.
 *
 * ⚠️ Elle appelle `App\Services\Ville`, qui lit `config/villes.php`. Rejouée
 * après une évolution de cette liste, elle rangerait donc différemment — sans
 * conséquence : sur une base neuve, il n'y a aucune annonce à ranger à ce
 * stade.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('villas', function (Blueprint $table) {
            $table->string('quartier', 100)->nullable()->after('ville');
        });

        DB::table('villas')->chunkById(200, function ($villas) {
            foreach ($villas as $villa) {
                ['ville' => $ville, 'quartier' => $quartier] = Ville::normaliser($villa->ville);

                if ($ville === $villa->ville && $quartier === null) {
                    continue;
                }

                DB::table('villas')->where('id', $villa->id)->update([
                    'ville' => $ville,
                    // Un quartier déjà renseigné n'est jamais écrasé : la
                    // colonne est neuve aujourd'hui, mais une migration doit
                    // rester sûre si on la rejoue.
                    'quartier'   => $villa->quartier ?? $quartier,
                    'updated_at' => now(),
                ]);
            }
        });
    }

    /**
     * Le retour en arrière recompose la saisie d'origine avant de perdre la
     * colonne : « Saly » + « Velingara » redonne « Saly Velingara ».
     *
     * ⚠️ Une annonce créée depuis, dont le propriétaire aurait rempli le
     * quartier séparément, verra les deux champs recollés. C'est le prix d'une
     * colonne qui disparaît, et cela reste une ville lisible.
     */
    public function down(): void
    {
        DB::table('villas')->whereNotNull('quartier')->chunkById(200, function ($villas) {
            foreach ($villas as $villa) {
                DB::table('villas')->where('id', $villa->id)->update([
                    'ville'      => mb_substr(trim($villa->ville.' '.$villa->quartier), 0, 100),
                    'updated_at' => now(),
                ]);
            }
        });

        Schema::table('villas', function (Blueprint $table) {
            $table->dropColumn('quartier');
        });
    }
};
