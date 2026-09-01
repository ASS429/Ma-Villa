<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Le numéro qui a servi à payer.
 *
 * Il était **demandé au client, envoyé à PayDunya, puis jeté**. Tant que
 * l'argent n'allait que dans un sens, cela ne se voyait pas : c'est PayDunya
 * qui débitait, nous n'avions rien à en faire.
 *
 * Le remboursement l'a rendu indispensable. Pour rendre l'argent, il faut
 * savoir **où l'envoyer**, et le numéro du compte n'est pas ce numéro-là : on
 * s'inscrit avec son téléphone personnel et on paie avec le Wave d'un proche,
 * ou avec un second numéro Orange Money. Virer sur le mauvais est une perte
 * sèche — l'argent part, et le client attend toujours.
 *
 * Nullable, et il le restera : les paiements antérieurs au 1er septembre 2026
 * ne l'ont pas. L'écran de remboursement le dit plutôt que d'afficher le
 * numéro du compte en le faisant passer pour celui du paiement.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('paiements', function (Blueprint $table) {
            $table->string('telephone_payeur', 30)->nullable()->after('methode');
        });
    }

    public function down(): void
    {
        Schema::table('paiements', function (Blueprint $table) {
            $table->dropColumn('telephone_payeur');
        });
    }
};
