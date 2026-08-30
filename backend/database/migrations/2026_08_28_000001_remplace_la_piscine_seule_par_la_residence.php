<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * « Piscine seule » sort du catalogue, « Résidence » y entre.
 *
 * ## Pourquoi la piscine est désactivée et non supprimée
 *
 * `logements.categorie_id` est en `nullOnDelete`. Supprimer la ligne mettrait
 * donc à `null` la catégorie de tous les logements qui s'y rattachent — et un
 * logement sans catégorie **disparaît de la recherche**, ce que la migration
 * qui a créé la table prenait déjà soin d'éviter.
 *
 * `actif = false` produit exactement l'effet demandé : la catégorie n'est plus
 * proposée nulle part, puisque l'interface ne sert que les catégories actives.
 * Les logements existants gardent la leur et restent affichables. Et le geste
 * se défait en une ligne le jour où l'offre reviendrait.
 *
 * ## La résidence
 *
 * Un immeuble d'appartements avec services — le pendant meublé de l'hôtel, à
 * la nuitée comme au mois. Elle prend les filtres de l'appartement, plus la
 * piscine : c'est l'équipement qu'on cherche en premier sur ce type de bien.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Le type de logement doit accepter `residence` avant qu'on propose la
        // catégorie : sans cela, la première résidence créée serait refusée par
        // la base, après avoir passé la validation applicative.
        //
        // `piscine` reste dans l'énumération — des logements la portent, et une
        // énumération ne se rétrécit pas sous les lignes qui l'emploient.
        $this->typesDeLogement(['villa_entiere', 'appartement', 'residence', 'chambre', 'piscine']);

        DB::table('categories')->where('cle', 'piscine')->update([
            'actif' => false,
            'updated_at' => now(),
        ]);

        // `updateOrInsert` plutôt qu'`insert` : la migration doit pouvoir se
        // rejouer sur une base où elle est déjà passée, ce que fait `start.sh`
        // à chaque démarrage.
        DB::table('categories')->updateOrInsert(
            ['cle' => 'residence'],
            [
                'nom'         => 'Résidence',
                'nom_pluriel' => 'Résidences',
                'unite_prix'  => 'nuitee',
                'formules'    => json_encode(['nuitee', 'journee', 'demi_journee', 'pass']),
                'filtres'     => json_encode(['chambres', 'capacite', 'meuble', 'climatisation', 'piscine']),
                // Juste après l'appartement, dont elle est voisine.
                'ordre'       => 2,
                'actif'       => true,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]
        );

        // L'ordre des suivantes glisse d'un cran, sinon deux catégories
        // partagent le même rang et l'affichage devient arbitraire.
        foreach (['studio' => 3, 'chambre' => 4, 'hotel' => 5, 'auberge' => 6] as $cle => $rang) {
            DB::table('categories')->where('cle', $cle)->update(['ordre' => $rang]);
        }
    }

    /**
     * Redéfinit l'énumération, moteur par moteur.
     *
     * `$table->enum()->change()` échoue différemment sur chacun des trois que
     * ce projet traverse : SQLite recrée la table et perd la contrainte,
     * PostgreSQL la porte en `check`, MySQL en type de colonne.
     */
    private function typesDeLogement(array $valeurs): void
    {
        $pilote = Schema::getConnection()->getDriverName();
        $liste = implode(', ', array_map(fn ($v) => "'{$v}'", $valeurs));

        if ($pilote === 'pgsql') {
            DB::statement('ALTER TABLE logements DROP CONSTRAINT IF EXISTS logements_type_check');
            DB::statement("ALTER TABLE logements ADD CONSTRAINT logements_type_check CHECK (type IN ({$liste}))");

            return;
        }

        if ($pilote === 'mysql' || $pilote === 'mariadb') {
            DB::statement("ALTER TABLE logements MODIFY type ENUM({$liste}) NOT NULL");
        }

        // SQLite : la contrainte est portée par la définition de la table, et
        // la recréer coûterait une copie complète. La validation applicative
        // est de toute façon la seule barrière qu'une requête HTTP traverse.
    }

    public function down(): void
    {
        DB::table('categories')->where('cle', 'residence')->update([
            'actif' => false,
            'updated_at' => now(),
        ]);

        DB::table('categories')->where('cle', 'piscine')->update([
            'actif' => true,
            'updated_at' => now(),
        ]);
    }
};
