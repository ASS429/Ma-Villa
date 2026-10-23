<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Une commande annulée alors qu'elle était payée — par l'administration, ou
 * réglée après son annulation — doit être remboursée à la main. Cette date
 * dit que c'est fait, et retire la commande de « Ce qui attend ».
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commandes', function (Blueprint $table) {
            $table->timestamp('remboursee_le')->nullable()->after('livree_le');
        });
    }

    public function down(): void
    {
        Schema::table('commandes', function (Blueprint $table) {
            $table->dropColumn('remboursee_le');
        });
    }
};
