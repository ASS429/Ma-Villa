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
 *
 * Depuis le 6 novembre 2026, PasseTemps encaisse le transport : une demande
 * **payée** est aussi une pièce comptable (somme reçue, part reversée). Elle
 * perd à douze mois tout ce qui désigne la personne, et ne s'efface qu'après
 * dix ans, comme un devis accepté.
 */
class EffacerLesDemandesDeServiceAnciennes extends Command
{
    public const MOIS = 12;

    /** La durée de conservation d'une pièce comptable. */
    public const ANS_PIECE_COMPTABLE = 10;

    protected $signature = 'passetemps:effacer-demandes-de-service';

    protected $description = 'Efface les demandes de service dont la date est passée de plus de douze mois (anonymise celles qui ont été payées)';

    public function handle(): int
    {
        $limite = now()->subMonths(self::MOIS)->toDateString();

        $effacees = DemandeService::where('date_service', '<', $limite)->whereNull('encaisse_le')->delete();

        // Ce qui désigne la personne part ; ce qui dit l'argent reste.
        $anonymisees = DemandeService::where('date_service', '<', $limite)
            ->whereNotNull('encaisse_le')
            ->where('nom', '!=', '—')
            ->update([
                'user_id' => null, 'nom' => '—', 'telephone' => '—', 'email' => null,
                'lieu' => '—', 'latitude' => null, 'longitude' => null, 'precision_m' => null,
                'vol' => null, 'delegation' => null, 'message' => null,
            ]);

        $pieces = DemandeService::where('date_service', '<', now()->subYears(self::ANS_PIECE_COMPTABLE)->toDateString())
            ->whereNotNull('encaisse_le')
            ->delete();

        $this->info("{$effacees} demande(s) de service effacée(s), {$anonymisees} payée(s) anonymisée(s), {$pieces} pièce(s) de plus de dix ans effacée(s).");

        return self::SUCCESS;
    }
}
