<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * La catégorie « studio » annonçait des prix au mois, une unité qu'aucun tarif
 * ne porte : ses formules sont la nuitée et le pass, et tous les studios en
 * ligne se louent à la nuit. Le filtre « Studio » affichait « prix en FCFA /
 * undefined ». Les longs séjours ont leur prix à la semaine et au mois sur le
 * tarif lui-même, pas dans la catégorie.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('categories')
            ->where('cle', 'studio')
            ->where('unite_prix', 'mois')
            ->update(['unite_prix' => 'nuitee']);
    }

    public function down(): void
    {
        DB::table('categories')->where('cle', 'studio')->update(['unite_prix' => 'mois']);
    }
};
