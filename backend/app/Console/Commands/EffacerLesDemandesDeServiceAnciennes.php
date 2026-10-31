<?php

namespace App\Console\Commands;

use App\Models\DemandeService;
use Illuminate\Console\Command;

/**
 * Efface les demandes de service douze mois après la date du service.
 *
 * C'est la durée annoncée par la politique de confidentialité depuis le
 * 31 octobre 2026. Une demande garde nom, téléphone, lieu, parfois numéro de
 * vol et position, **sans compte** : rien ne justifie de la garder au-delà de
 * ce qu'il faut pour répondre à une réclamation. Sans cette commande, la
 * durée annoncée serait une promesse que rien ne tient.
 */
class EffacerLesDemandesDeServiceAnciennes extends Command
{
    public const MOIS = 12;

    protected $signature = 'passetemps:effacer-demandes-de-service';

    protected $description = 'Efface les demandes de service dont la date est passée de plus de douze mois';

    public function handle(): int
    {
        $effacees = DemandeService::where('date_service', '<', now()->subMonths(self::MOIS)->toDateString())->delete();

        $this->info("{$effacees} demande(s) de service effacée(s).");

        return self::SUCCESS;
    }
}
