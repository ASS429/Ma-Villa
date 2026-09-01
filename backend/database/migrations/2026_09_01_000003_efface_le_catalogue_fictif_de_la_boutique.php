<?php

use App\Models\Oeuvre;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Efface les articles de démonstration, pour faire place au vrai catalogue.
 *
 * La migration précédente les avait mis en brouillon, ce qui suffisait à vider
 * la vitrine. Mais l'exploitant va saisir son catalogue réel : dix-neuf faux
 * brouillons dans l'écran « Articles » sont dix-neuf occasions de se tromper
 * de ligne, et le peuplement ne doit surtout pas les ramener.
 *
 * **La boutique reste ouverte.** C'est le choix de l'exploitant : il ne s'agit
 * pas de fermer le métier mais de le vider avant de le remplir.
 *
 * ⚠️ Un article déjà commandé n'est **pas** effacé, même fictif. Le supprimer
 * emporterait la trace comptable d'une vente — c'est exactement la règle que
 * `OeuvreController::destroy` applique à la main, et une migration n'a aucune
 * raison d'être moins prudente qu'un opérateur. Ceux-là restent en brouillon,
 * invisibles.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Ce qui n'a jamais été commandé peut disparaître sans laisser de trou.
        $effacables = DB::table('oeuvres')
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                  ->from('commandes')
                  ->whereColumn('commandes.oeuvre_id', 'oeuvres.id');
            })
            ->pluck('id');

        if ($effacables->isEmpty()) {
            return;
        }

        // Les photographies sont polymorphes : rien ne les emporte
        // automatiquement, et elles resteraient à pointer vers un article
        // disparu.
        DB::table('photos')
            ->where('photoable_type', Oeuvre::class)
            ->whereIn('photoable_id', $effacables)
            ->delete();

        DB::table('oeuvres')->whereIn('id', $effacables)->delete();
    }

    /**
     * Rien à défaire.
     *
     * Le peuplement sait recréer ce catalogue :
     * `php artisan db:seed --class=BoutiqueSeeder`. Recopier ici dix-neuf
     * articles serait tenir la même liste à deux endroits, et c'est toujours
     * la copie oubliée qui finit par mentir.
     */
    public function down(): void
    {
        //
    }
};
