<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Minishlink\WebPush\VAPID;

/**
 * Génère la paire de clés VAPID qui identifie ce serveur auprès des services
 * de poussée.
 *
 * À lancer **une seule fois**, puis à recopier dans les variables
 * d'environnement. Régénérer les clés invalide d'un coup tous les abonnements
 * en place : chaque utilisateur doit réautoriser à la main, et personne ne
 * comprend pourquoi ses notifications se sont tues.
 */
class GenererClesPush extends Command
{
    protected $signature = 'push:cles';

    protected $description = 'Génère une paire de clés VAPID pour les notifications poussées';

    public function handle(): int
    {
        if (config('push.vapid.privee') !== '') {
            $this->warn('Des clés VAPID sont déjà configurées.');
            $this->line('Les remplacer couperait les notifications de tous les appareils déjà abonnés,');
            $this->line('qui devraient chacun les réactiver à la main.');

            if (! $this->confirm('Générer une nouvelle paire malgré tout ?', false)) {
                return self::SUCCESS;
            }
        }

        try {
            $cles = VAPID::createVapidKeys();
        } catch (\Throwable $e) {
            $this->error('Génération impossible : '.$e->getMessage());
            $this->line('Vérifiez que les extensions PHP openssl et gmp sont chargées.');

            return self::FAILURE;
        }

        $this->newLine();
        $this->info('Clés générées. À poser dans les variables d\'environnement du serveur :');
        $this->newLine();
        $this->line('VAPID_SUJET="mailto:contact@mavilla.sn"');
        $this->line('VAPID_CLE_PUBLIQUE="'.$cles['publicKey'].'"');
        $this->line('VAPID_CLE_PRIVEE="'.$cles['privateKey'].'"');
        $this->newLine();
        $this->warn('La clé privée ne doit jamais être versionnée ni transmise au navigateur.');

        return self::SUCCESS;
    }
}
