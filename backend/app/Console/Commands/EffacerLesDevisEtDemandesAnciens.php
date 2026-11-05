<?php

namespace App\Console\Commands;

use App\Models\DemandeParticuliere;
use App\Models\Devis;
use App\Models\DevisRefuse;
use Illuminate\Console\Command;

/**
 * Tient les durées que la politique de confidentialité annonce depuis le
 * 4 novembre 2026 : un devis accepté dix ans, un devis sans suite et une demande
 * particulière trois ans. Sans compte, ces lignes portent un nom et un numéro :
 * rien ne justifie de les garder au-delà de ce qu'il faut pour reconnaître un
 * client qui revient.
 *
 * Changer une durée ici, c'est changer le § 6 du texte dans le même mouvement.
 */
class EffacerLesDevisEtDemandesAnciens extends Command
{
    public const ANS_ACCEPTES = 10;

    public const ANS_SANS_SUITE = 3;

    protected $signature = 'passetemps:effacer-devis-et-demandes';

    protected $description = 'Efface les devis et les demandes particulières arrivés au bout de leur durée de conservation';

    public function handle(): int
    {
        // `forceDelete` : avec les devis supprimés à la main (`withTrashed`), et pour de
        // bon. Un simple `delete()` ne ferait que les marquer, coordonnées comprises.
        $acceptes = Devis::where('statut', 'accepte')
            ->where('created_at', '<', now()->subYears(self::ANS_ACCEPTES))
            ->forceDelete();

        $sansSuite = Devis::withTrashed()->where('statut', '!=', 'accepte')
            ->where('created_at', '<', now()->subYears(self::ANS_SANS_SUITE))
            ->forceDelete();

        $demandes = DemandeParticuliere::where('created_at', '<', now()->subYears(self::ANS_SANS_SUITE))->delete();

        DevisRefuse::where('created_at', '<', now()->subYears(self::ANS_SANS_SUITE))->delete();

        $this->info("{$acceptes} devis accepté(s), {$sansSuite} devis sans suite et {$demandes} demande(s) particulière(s) effacés.");

        return self::SUCCESS;
    }
}
