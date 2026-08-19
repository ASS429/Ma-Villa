<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\ReversementController;
use App\Models\Reversement;
use App\Services\Deboursement;
use Illuminate\Console\Command;

/**
 * Tranche le sort des déboursements restés en suspens.
 *
 * Le rappel de PayDunya n'est pas une garantie : il peut ne jamais arriver —
 * réseau coupé, redémarrage du conteneur au mauvais moment, URL momentanément
 * injoignable. Sans ce rattrapage, un versement resterait « en cours »
 * indéfiniment, et son montant disparaîtrait des deux consoles : plus dans la
 * file d'attente puisqu'il est rattaché, pas encore versé puisqu'il n'a pas
 * abouti. C'est exactement la façon dont de l'argent se perd de vue.
 *
 * Même raisonnement que pour l'encaissement, où l'IPN n'a jamais suffi.
 *
 * À lancer périodiquement :
 *
 *     php artisan mavilla:suivre-reversements
 */
class SuivreLesReversements extends Command
{
    protected $signature = 'mavilla:suivre-reversements
                            {--age=2 : ne relire que les versements en cours depuis au moins N minutes}';

    protected $description = 'Interroge PayDunya sur les reversements restés en cours';

    public function handle(Deboursement $deboursement, ReversementController $reversements): int
    {
        if (! $deboursement->disponible()) {
            $this->comment('Déboursement automatique inactif : rien à suivre.');

            return self::SUCCESS;
        }

        // Un versement soumis il y a dix secondes est normalement en cours :
        // le relire aussitôt ferait un appel pour rien à chaque passage.
        $enCours = Reversement::where('statut', 'en_cours')
            ->whereNotNull('disburse_token')
            ->where('updated_at', '<=', now()->subMinutes((int) $this->option('age')))
            ->get();

        if ($enCours->isEmpty()) {
            $this->info('Aucun reversement en attente de réponse.');

            return self::SUCCESS;
        }

        $tranches = 0;

        foreach ($enCours as $reversement) {
            $verifie = $deboursement->statut($reversement->disburse_token);

            $reversements->inscrireLeStatut(
                $reversement,
                $verifie['statut'],
                $verifie['brut']['response_text'] ?? null,
                $verifie['brut'],
            );

            $apres = $reversement->fresh();
            $this->line(sprintf(
                '  #%d · %s · %s → %s',
                $reversement->id,
                $reversement->beneficiaire_nom,
                $verifie['statut'] ?? 'inconnu',
                $apres?->statut ?? '?',
            ));

            if ($apres && $apres->statut !== 'en_cours') {
                $tranches++;
            }
        }

        $this->info("{$enCours->count()} vérifié(s), {$tranches} tranché(s).");

        return self::SUCCESS;
    }
}
