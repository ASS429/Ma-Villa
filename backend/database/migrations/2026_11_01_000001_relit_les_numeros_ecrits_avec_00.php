<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Relit les numéros enregistrés avec le préfixe « 00 ».
 *
 * Jusqu'au 1er novembre 2026, « 00221 77 123 45 67 » gardait sa forme
 * canonique « 00221771234567 » : le compte ne se retrouvait pas en tapant
 * « 77 123 45 67 ». La règle lit désormais 00221 comme +221 ; sans cette
 * reprise, ces comptes ne se retrouveraient plus du tout — ni par l'ancienne
 * écriture, que la nouvelle règle ramène à neuf chiffres, ni par la nouvelle.
 *
 * Seules les lignes dont la forme change sont touchées. Une forme déjà portée
 * par un autre compte n'est pas écrite : la colonne est unique, et sous
 * Postgres un seul conflit annulerait toute la migration. Le plus ancien
 * garde le numéro, comme à la création de la colonne.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->select('id', 'phone', 'phone_normalise')
            ->whereNotNull('phone')
            ->orderBy('id')
            ->chunkById(200, function ($lignes) {
                foreach ($lignes as $ligne) {
                    $normalise = User::normaliserNumero($ligne->phone);

                    if ($normalise === $ligne->phone_normalise) {
                        continue;
                    }

                    $pris = $normalise !== null && DB::table('users')
                        ->where('phone_normalise', $normalise)
                        ->where('id', '!=', $ligne->id)
                        ->exists();

                    if (! $pris) {
                        DB::table('users')->where('id', $ligne->id)
                            ->update(['phone_normalise' => $normalise]);
                    }
                }
            });
    }

    /** Rien à défaire : l'ancienne forme ne retrouvait pas ces comptes. */
    public function down(): void
    {
    }
};
