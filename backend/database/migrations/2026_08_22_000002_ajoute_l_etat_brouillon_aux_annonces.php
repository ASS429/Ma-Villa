<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * L'état « brouillon ».
 *
 * Publier une villa demandait de tout remplir d'un coup : nom, description,
 * adresse, téléphone. Un propriétaire qui s'arrêtait au milieu perdait sa
 * saisie, et on ne le revoyait pas — c'est le seul écran dont l'échec se
 * mesure en annonces qui n'existent pas, puisque personne ne vient se
 * plaindre d'une annonce qu'il n'a pas créée.
 *
 * Le formulaire devient donc une suite d'étapes, enregistrée à chaque pas. Il
 * fallait pour cela un état où l'annonce **existe sans exister** : invisible
 * du public, et surtout **absente de la file de modération**. Sans lui, une
 * annonce à demi remplie arriverait chez l'administrateur dès la première
 * étape, et il passerait ses journées à rejeter des ébauches.
 *
 * `en_attente` garde donc son sens exact : « le propriétaire a fini, à vous ».
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->redefinirStatut(['brouillon', 'en_attente', 'validee', 'rejetee']);

        // Un brouillon n'a par définition pas encore sa description, son
        // adresse ni son numéro : la base doit l'accepter, sinon la première
        // étape échoue avant même d'avoir commencé. Ce qui les rend
        // obligatoires n'est plus le schéma mais la publication, qui refuse
        // une annonce à laquelle il manque quoi que ce soit.
        Schema::table('villas', function (Blueprint $table) {
            $table->text('description')->nullable()->change();
            $table->string('adresse')->nullable()->change();
            $table->string('telephone', 50)->nullable()->change();
        });
    }

    public function down(): void
    {
        // Un brouillon n'a pas d'équivalent en arrière : le remettre en
        // attente le pousserait dans la file de modération, ce qui est
        // exactement ce qu'on cherchait à éviter. Il est donc rejeté, état
        // dont le propriétaire peut le sortir.
        DB::table('villas')->where('statut', 'brouillon')->update(['statut' => 'rejetee']);

        // Remettre les colonnes obligatoires demande de boucher les trous :
        // une annonce sans description ferait échouer l'`ALTER`.
        DB::table('villas')->whereNull('description')->update(['description' => '']);
        DB::table('villas')->whereNull('adresse')->update(['adresse' => '']);
        DB::table('villas')->whereNull('telephone')->update(['telephone' => '']);

        Schema::table('villas', function (Blueprint $table) {
            $table->text('description')->nullable(false)->change();
            $table->string('adresse')->nullable(false)->change();
            $table->string('telephone', 50)->nullable(false)->change();
        });

        $this->redefinirStatut(['en_attente', 'validee', 'rejetee']);
    }

    /**
     * SQLite ne sait pas modifier une colonne : Laravel la recrée, et une
     * contrainte `check` d'énumération se perd en chemin. PostgreSQL, lui,
     * refuse un `ALTER` d'énumération dans une transaction implicite.
     *
     * On passe donc par une redéfinition explicite, portable, plutôt que par
     * `$table->enum(...)->change()` — qui échoue différemment sur chacun des
     * trois moteurs que ce projet traverse (SQLite en test, MySQL en local,
     * PostgreSQL en production).
     */
    private function redefinirStatut(array $valeurs): void
    {
        $pilote = Schema::getConnection()->getDriverName();
        $liste = implode(', ', array_map(fn ($v) => "'{$v}'", $valeurs));

        if ($pilote === 'pgsql') {
            DB::statement('ALTER TABLE villas DROP CONSTRAINT IF EXISTS villas_statut_check');
            DB::statement("ALTER TABLE villas ADD CONSTRAINT villas_statut_check CHECK (statut IN ({$liste}))");

            return;
        }

        if ($pilote === 'mysql' || $pilote === 'mariadb') {
            DB::statement("ALTER TABLE villas MODIFY statut ENUM({$liste}) NOT NULL DEFAULT 'en_attente'");

            return;
        }

        // SQLite : la contrainte est portée par la définition de la table, et
        // la recréer coûterait une copie complète. Les tests s'appuient sur la
        // validation applicative, qui est de toute façon la seule barrière que
        // traverse une requête HTTP.
        Schema::table('villas', function (Blueprint $table) {
            // Rien à faire : aucune contrainte à lever.
        });
    }
};
