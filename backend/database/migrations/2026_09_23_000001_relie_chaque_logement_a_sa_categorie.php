<?php

use App\Models\Logement;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Répare les logements sans catégorie, et ouvre le type aux trois qui manquaient.
 *
 * ## Ce qui n'allait pas
 *
 * La recherche par catégorie joint `logements.categorie_id`. Or **personne ne
 * l'écrivait** : `LogementRequest` ne l'a jamais accepté, et seule la migration
 * du 12 août 2026 l'avait rempli pour les logements d'alors. Toute annonce
 * créée depuis avait donc une catégorie nulle.
 *
 * Constaté le 23 septembre 2026, relevé par l'exploitant : dix annonces
 * publiées, et **les sept filtres de catégorie rendaient zéro**. La migration
 * du 12 août le redoutait déjà en toutes lettres — « sans cela, les annonces
 * publiées se retrouveraient sans catégorie et disparaîtraient de la
 * recherche ».
 *
 * ## Les trois types qui manquaient
 *
 * Le catalogue propose sept catégories, l'énumération n'en connaissait que
 * cinq : ni studio, ni hôtel, ni auberge. Un propriétaire d'auberge ne pouvait
 * pas le dire — deux des annonces s'appellent pourtant « Auberge ».
 *
 * L'énumération ne rétrécit pas : `piscine` y reste, des logements la portent.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->typesDeLogement([
            'villa_entiere', 'appartement', 'residence', 'studio',
            'chambre', 'hotel', 'auberge', 'piscine',
        ]);

        // Les catégories sont en base : on lit la correspondance plutôt que de
        // la réécrire, pour que les deux ne puissent pas diverger.
        $categories = DB::table('categories')->pluck('id', 'cle');

        foreach ($categories as $cle => $id) {
            DB::table('logements')
                ->whereNull('categorie_id')
                ->where('type', Logement::typePour($cle))
                ->update(['categorie_id' => $id]);
        }
    }

    /**
     * Rien à défaire.
     *
     * Le remplissage **répare** des lignes : les remettre à `null` recréerait
     * le défaut, et on ne sait de toute façon plus lesquelles l'étaient. Quant
     * à l'énumération, elle ne se rétrécit pas sous les lignes qui emploient
     * ses valeurs — même raison que pour `piscine` le 28 août.
     */
    public function down(): void
    {
        //
    }

    /**
     * Chaque base porte la contrainte à sa façon. Repris de la migration du
     * 28 août, qui a introduit `residence`.
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

        // SQLite : la contrainte vit dans la définition de la table, et la
        // recréer coûterait une copie complète. La validation applicative est
        // de toute façon la seule barrière qu'une requête HTTP traverse.
    }
};
