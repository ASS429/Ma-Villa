<?php

namespace App\Console\Commands;

use App\Models\Reservation;
use App\Services\Push;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Annule les demandes qu'un propriétaire n'a pas tranchées à temps.
 *
 * Une demande qui traîne coûte plus cher qu'un refus : le client attend, ne
 * cherche pas ailleurs, et découvre trop tard qu'il n'a nulle part où dormir.
 *
 * **Aucun remboursement n'est à faire, et ce n'est pas un oubli.** Un paiement
 * abouti confirme la réservation sans intervention du propriétaire : une demande
 * restée « en attente » n'a donc jamais été réglée. La règle vaut tant que ce
 * comportement tient — un test l'y attache.
 *
 *     php artisan mavilla:annuler-demandes-sans-reponse
 */
class AnnulerLesDemandesSansReponse extends Command
{
    protected $signature = 'mavilla:annuler-demandes-sans-reponse';

    protected $description = 'Annule les demandes de réservation restées sans réponse au-delà du délai';

    public function handle(Push $push): int
    {
        $heures = (int) config('reservations.delai_reponse_heures');
        $limite = now()->subHours($heures);

        $demandes = Reservation::where('statut', 'en_attente')
            ->where('created_at', '<=', $limite)
            ->with(['client', 'logement.villa.proprietaire', 'paiement'])
            ->get();

        if ($demandes->isEmpty()) {
            $this->info('Aucune demande à annuler.');

            return self::SUCCESS;
        }

        $annulees = 0;

        foreach ($demandes as $demande) {
            if ($this->annuler($demande)) {
                $annulees++;
                $this->prevenir($push, $demande, $heures);
                $this->line("  #{$demande->id} · {$demande->logement?->villa?->nom} · annulée");
            }
        }

        $this->info("{$annulees} demande(s) annulée(s) sur {$demandes->count()} examinée(s).");

        return self::SUCCESS;
    }

    /**
     * Relit sous verrou avant d'écrire.
     *
     * Entre la sélection et l'écriture, un propriétaire peut avoir confirmé, ou
     * un paiement avoir abouti — ce qui confirme aussi. Annuler alors
     * détruirait un séjour réglé. Le verrou et la relecture ferment cette
     * fenêtre ; c'est le même motif que la course sur les dates.
     */
    private function annuler(Reservation $demande): bool
    {
        return (bool) DB::transaction(function () use ($demande) {
            $fraiche = Reservation::whereKey($demande->id)->lockForUpdate()->first();

            if (! $fraiche || $fraiche->statut !== 'en_attente') {
                return false;
            }

            // Ceinture et bretelles : si un paiement a malgré tout abouti sans
            // que le statut ait suivi, on ne touche à rien et on le signale.
            if ($fraiche->paiement()->where('statut', 'reussi')->exists()) {
                $this->warn("  #{$fraiche->id} · payée mais restée en attente — laissée telle quelle.");

                return false;
            }

            $fraiche->update(['statut' => 'annulee']);

            return true;
        });
    }

    /**
     * Les deux parties sont prévenues, et pour des raisons différentes.
     *
     * Le client doit pouvoir chercher ailleurs. Le propriétaire doit savoir
     * qu'il a laissé passer une demande — c'est ce qui le fera répondre à la
     * suivante.
     */
    private function prevenir(Push $push, Reservation $demande, int $heures): void
    {
        $villa = $demande->logement?->villa?->nom ?? 'votre séjour';

        if ($demande->client) {
            $push->versUtilisateur($demande->client, [
                'titre'  => 'Demande annulée',
                'corps'  => "{$villa} — le propriétaire n'a pas répondu sous {$heures} h. "
                            .'Rien ne vous a été débité.',
                'url'    => '/villas',
                'groupe' => "reservation-{$demande->id}",
            ]);
        }

        if ($proprietaire = $demande->logement?->villa?->proprietaire) {
            $push->versUtilisateur($proprietaire, [
                'titre'  => 'Demande expirée',
                'corps'  => "Une demande sur {$villa} a été annulée faute de réponse sous {$heures} h.",
                'url'    => '/dashboard/reservations',
                'groupe' => "reservation-{$demande->id}",
            ]);
        }
    }
}
