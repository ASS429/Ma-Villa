<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Retire les comptes de démonstration et l'ancien compte admin@mavilla.sn.
 *
 * Leurs adresses n'étaient pas à nous : @mavilla.sn est un domaine libre, que
 * n'importe qui peut acheter pour recevoir le lien « mot de passe oublié », et
 * les clients portaient des gmail inventés qui peuvent appartenir à de vraies
 * personnes. L'exploitant a son propre compte admin.
 *
 * Supprimer un propriétaire emporte ses villas, leurs logements et les
 * réservations faites dessus. Un compte lié à de l'argent réel — paiement
 * abouti, reversement, commande réglée — ou à une annonce publiée est donc
 * gardé et signalé, jamais supprimé. Le journal d'administration, les
 * messages et les remboursements gardent leur trace (clés `nullOnDelete`).
 *
 * Sans retour : `down` ne recrée rien.
 */
return new class extends Migration
{
    private const COMPTES = [
        'admin@mavilla.sn',
        'amadou.diallo@mavilla.sn',
        'fatou.ndiaye@mavilla.sn',
        'ibrahima.fall@mavilla.sn',
        'sophie.martin@gmail.com',
        'mamadou.gueye@gmail.com',
        'aissatou.ba@gmail.com',
        'pierre.dupont@gmail.com',
        'mariama.diop@gmail.com',
        'jeanluc.bernard@gmail.com',
    ];

    public function up(): void
    {
        foreach (self::COMPTES as $email) {
            $compte = DB::table('users')->where('email', $email)->first();

            if (! $compte) {
                continue;
            }

            if ($raison = $this->raisonDeGarder($compte)) {
                $this->dire("gardé : {$email} — {$raison}");

                continue;
            }

            try {
                DB::transaction(function () use ($compte) {
                    DB::table('personal_access_tokens')
                        ->where('tokenable_type', 'App\\Models\\User')
                        ->where('tokenable_id', $compte->id)
                        ->delete();
                    DB::table('users')->where('id', $compte->id)->delete();
                });
                $this->dire("supprimé : {$email}");
            } catch (\Throwable $e) {
                $this->dire("gardé : {$email} — suppression refusée par la base ({$e->getMessage()})");
            }
        }
    }

    private function raisonDeGarder(object $compte): ?string
    {
        if ($compte->role === 'admin'
            && DB::table('users')->where('role', 'admin')->where('id', '!=', $compte->id)->doesntExist()) {
            return "c'est le seul admin";
        }

        $paiementAbouti = DB::table('paiements')
            ->join('reservations', 'reservations.id', '=', 'paiements.reservation_id')
            ->join('logements', 'logements.id', '=', 'reservations.logement_id')
            ->join('villas', 'villas.id', '=', 'logements.villa_id')
            ->where('paiements.statut', 'reussi')
            ->where(fn ($q) => $q->where('reservations.user_id', $compte->id)
                ->orWhere('villas.user_id', $compte->id))
            ->exists();

        if ($paiementAbouti) {
            return 'un paiement abouti le concerne';
        }

        if (DB::table('reversements')->where('user_id', $compte->id)->exists()) {
            return 'il a reçu un reversement';
        }

        if (DB::table('commandes')->where('user_id', $compte->id)->where('statut_paiement', 'reussi')->exists()) {
            return 'il a une commande réglée';
        }

        if (DB::table('villas')->where('user_id', $compte->id)->where('statut', 'validee')->exists()) {
            return 'il détient une annonce publiée';
        }

        return null;
    }

    private function dire(string $ligne): void
    {
        Log::warning("Comptes de démonstration — {$ligne}");
        echo "  {$ligne}\n";
    }

    public function down(): void
    {
        // Rien à recréer : ces comptes ne doivent pas revenir.
    }
};
