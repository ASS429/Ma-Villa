<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Neutralise le dernier compte de démonstration, retrouvé le 2 novembre 2026.
 *
 * `2026_10_23_000001` devait le supprimer ; elle garde tout compte lié à de
 * l'argent réel, et celui-ci est resté. Son adresse est sur @mavilla.sn, un
 * domaine libre : qui l'achète reçoit le lien « mot de passe oublié » et entre
 * dans un compte propriétaire.
 *
 * On ne le supprime donc pas davantage : une adresse à nous sans boîte, un mot
 * de passe que personne ne connaît, et plus aucune session. Ses paiements et
 * son historique restent rattachés à lui. Sans retour : `down` ne fait rien.
 */
return new class extends Migration
{
    private const ANCIENNE_ADRESSE = 'amadou.diallo@mavilla.sn';

    public function up(): void
    {
        $compte = DB::table('users')->where('email', self::ANCIENNE_ADRESSE)->first();

        if ($compte === null) {
            return;
        }

        DB::table('users')->where('id', $compte->id)->update([
            'name'           => 'Amadou Diallo (démonstration)',
            'email'          => "compte-demonstration-{$compte->id}@passetemps.sn",
            'password'       => Hash::make(Str::random(64)),
            'remember_token' => null,
            'updated_at'     => now(),
        ]);

        DB::table('personal_access_tokens')
            ->where('tokenable_type', 'App\\Models\\User')
            ->where('tokenable_id', $compte->id)
            ->delete();
        DB::table('password_reset_tokens')->where('email', self::ANCIENNE_ADRESSE)->delete();
        DB::table('abonnements_push')->where('user_id', $compte->id)->delete();
    }

    public function down(): void
    {
    }
};
