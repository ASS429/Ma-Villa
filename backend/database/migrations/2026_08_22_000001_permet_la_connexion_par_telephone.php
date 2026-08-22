<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Connexion par téléphone.
 *
 * Beaucoup de propriétaires sénégalais n'ont pas d'adresse électronique qu'ils
 * consultent — mais tous ont un numéro, et c'est celui qu'ils donnent. Exiger
 * une adresse à la connexion revient à leur demander de se souvenir de
 * quelque chose qu'ils n'utilisent pas.
 *
 * Le numéro seul ne suffit pas à identifier un compte tel qu'il est stocké :
 * « +221 77 123 45 67 », « 77 123 45 67 » et « 221771234567 » désignent la
 * même ligne et ne se comparent pas. D'où cette colonne, qui porte la forme
 * canonique — chiffres seulement, indicatif local retiré.
 *
 * Elle est **unique**. Sans cela, deux comptes pourraient porter le même
 * numéro et la connexion n'aurait aucun moyen de choisir. La contrainte est
 * posée après le remplissage, et le remplissage écarte les doublons plutôt
 * que d'échouer : des comptes existants peuvent parfaitement partager un
 * numéro aujourd'hui, et rien ne justifie de casser la migration pour cela.
 *
 * ⚠️ L'adresse électronique reste obligatoire à l'inscription. C'est elle qui
 * porte la réinitialisation du mot de passe : un compte joignable par le seul
 * téléphone, sans envoi de SMS, serait irrécupérable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone_normalise', 32)->nullable()->after('phone');
        });

        $this->remplir();

        Schema::table('users', function (Blueprint $table) {
            $table->unique('phone_normalise');
        });
    }

    /**
     * Reprend les numéros déjà saisis.
     *
     * Un numéro déjà porté par un compte antérieur est laissé à `null` : le
     * compte reste utilisable par son adresse, et c'est le plus ancien qui
     * garde le numéro. Choisir l'inverse ferait perdre la connexion par
     * téléphone à quelqu'un qui l'avait déjà.
     */
    private function remplir(): void
    {
        $vus = [];

        DB::table('users')
            ->select('id', 'phone')
            ->whereNotNull('phone')
            ->orderBy('id')
            ->chunkById(200, function ($lignes) use (&$vus) {
                foreach ($lignes as $ligne) {
                    $normalise = User::normaliserNumero($ligne->phone);

                    if ($normalise === null || isset($vus[$normalise])) {
                        continue;
                    }

                    $vus[$normalise] = true;
                    DB::table('users')->where('id', $ligne->id)
                        ->update(['phone_normalise' => $normalise]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['phone_normalise']);
            $table->dropColumn('phone_normalise');
        });
    }
};
