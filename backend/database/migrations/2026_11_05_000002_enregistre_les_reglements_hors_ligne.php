<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Enregistrer l'argent reçu hors du site, tant que le paiement en ligne est fermé.
 *
 * `reglements` : le registre, une ligne par somme reçue, numérotée et jamais effacée.
 *
 * `paiements.hors_ligne` et `paiements.solde` : un dossier réglé à la main alimente le même
 * paiement que le site, pour que commission, reversement et remboursement fonctionnent
 * sans double compte. `solde` retient le reversement tant que tout n'est pas encaissé.
 *
 * `reservations.user_id` devient facultatif : le client d'un devis n'a pas forcément de
 * compte, et ses coordonnées sont alors portées par la réservation. On ne lui crée pas de
 * compte à son insu, et un compte d'attente partagé mélangerait tous ces clients.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable()->change();
            $table->string('client_nom', 160)->nullable();
            $table->string('client_telephone', 40)->nullable();
            $table->string('client_email', 160)->nullable();
        });

        Schema::table('devis', function (Blueprint $table) {
            $table->foreignId('reservation_id')->nullable()->constrained('reservations')->nullOnDelete();
        });

        Schema::table('paiements', function (Blueprint $table) {
            $table->boolean('hors_ligne')->default(false);
            $table->decimal('solde', 12, 2)->default(0);
            // Le taux du circuit des associés au premier règlement : à qui part l'argent et
            // combien ne changent pas en cours de dossier, même si l'annonce change.
            $table->decimal('majoration_figee', 8, 4)->nullable();
        });

        $this->autoriserLesMoyens(['wave', 'orange_money', 'carte', 'hors_ligne']);

        Schema::create('reglements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('devis_id')->nullable()->constrained('devis')->nullOnDelete();
            $table->foreignId('reservation_id')->nullable()->constrained('reservations')->nullOnDelete();
            $table->foreignId('villa_id')->nullable()->constrained('villas')->nullOnDelete();
            $table->unsignedSmallInteger('annee');
            $table->unsignedInteger('rang');
            $table->string('numero', 20)->unique();
            $table->string('cle', 64)->unique();
            $table->unsignedInteger('montant');
            $table->string('moyen', 20);
            $table->string('reference', 120)->nullable()->index();
            $table->string('payeur_telephone', 30)->nullable();
            // Recopiés : un reçu est une pièce, il doit survivre au devis.
            $table->string('client_nom', 160);
            $table->string('devis_numero', 30)->nullable();
            $table->string('langue', 2)->default('fr');
            $table->date('recu_le')->index();
            $table->text('note')->nullable();
            $table->string('statut', 10)->default('valide')->index();
            $table->timestamp('annule_le')->nullable();
            $table->string('annule_motif', 500)->nullable();
            $table->string('annule_par_nom')->nullable();
            $table->foreignId('cree_par')->nullable()->constrained('users')->nullOnDelete();
            $table->string('createur_nom');
            $table->timestamps();

            $table->unique(['annee', 'rang']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reglements');

        DB::table('paiements')->where('methode', 'hors_ligne')->delete();
        $this->autoriserLesMoyens(['wave', 'orange_money', 'carte']);

        Schema::table('paiements', function (Blueprint $table) {
            $table->dropColumn(['hors_ligne', 'solde', 'majoration_figee']);
        });

        Schema::table('devis', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reservation_id');
        });

        // Une réservation sans compte n'a pas d'équivalent en arrière.
        DB::table('reservations')->whereNull('user_id')->delete();

        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn(['client_nom', 'client_telephone', 'client_email']);
            $table->unsignedBigInteger('user_id')->nullable(false)->change();
        });
    }

    /** La contrainte d'énumération se redéfinit à la main : voir `ajoute_l_etat_brouillon_aux_annonces`. */
    private function autoriserLesMoyens(array $valeurs): void
    {
        $pilote = Schema::getConnection()->getDriverName();
        $liste = implode(', ', array_map(fn ($v) => "'{$v}'", $valeurs));

        if ($pilote === 'pgsql') {
            DB::statement('ALTER TABLE paiements DROP CONSTRAINT IF EXISTS paiements_methode_check');
            DB::statement("ALTER TABLE paiements ADD CONSTRAINT paiements_methode_check CHECK (methode IN ({$liste}))");

            return;
        }

        if ($pilote === 'mysql' || $pilote === 'mariadb') {
            DB::statement("ALTER TABLE paiements MODIFY methode ENUM({$liste}) NOT NULL");

            return;
        }

        // SQLite (les tests) : modifier la colonne recrée la table, sans la contrainte.
        Schema::table('paiements', function (Blueprint $table) {
            $table->string('methode', 20)->change();
        });
    }
};
