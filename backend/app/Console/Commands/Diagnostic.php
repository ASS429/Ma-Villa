<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

/**
 * Contrôle les dépendances d'infrastructure qui échouent silencieusement :
 * un email non parti, une photo écrite sur un disque éphémère ou une file
 * d'attente sans worker ne produisent aucune erreur visible.
 */
class Diagnostic extends Command
{
    protected $signature = 'mavilla:diagnostic {--email= : envoie un message de test à cette adresse}';

    protected $description = "Vérifie base, stockage, file d'attente et envoi d'emails";

    private int $alertes = 0;

    public function handle(): int
    {
        $this->info('Diagnostic Ma Villa');
        $this->newLine();

        $this->verifierBase();
        $this->verifierStockage();
        $this->verifierFile();
        $this->verifierMail();

        $this->newLine();

        if ($this->alertes > 0) {
            $this->warn("{$this->alertes} point(s) à corriger — voir docs/05-MISE-EN-PRODUCTION.md");

            return self::FAILURE;
        }

        $this->info('Tout est en ordre.');

        return self::SUCCESS;
    }

    private function verifierBase(): void
    {
        try {
            $pilote = DB::connection()->getDriverName();
            DB::select('select 1');
            $this->ok("Base accessible ({$pilote})");

            if (app()->environment('production') && $pilote !== 'pgsql') {
                $this->alerte("La production attend PostgreSQL, pilote détecté : {$pilote}");
            }
        } catch (\Throwable $e) {
            $this->alerte('Base inaccessible : '.$e->getMessage());
        }
    }

    private function verifierStockage(): void
    {
        $disque = config('filesystems.media');

        try {
            $sonde = 'diagnostic/'.uniqid().'.txt';
            Storage::disk($disque)->put($sonde, 'ok');
            $lu = Storage::disk($disque)->get($sonde) === 'ok';
            Storage::disk($disque)->delete($sonde);

            $lu ? $this->ok("Stockage « {$disque} » accessible en lecture et écriture")
                : $this->alerte("Stockage « {$disque} » : écriture sans relecture possible");
        } catch (\Throwable $e) {
            $this->alerte("Stockage « {$disque} » inutilisable : ".$e->getMessage());

            return;
        }

        if (app()->environment('production') && in_array($disque, ['local', 'public'], true)) {
            $this->alerte(
                "MEDIA_DISK vaut « {$disque} » : les photos sont écrites sur le disque du "
                .'conteneur et seront perdues au prochain déploiement. Basculez sur un stockage objet.'
            );
        }
    }

    private function verifierFile(): void
    {
        $connexion = config('queue.default');

        if ($connexion === 'sync') {
            if (app()->environment('production')) {
                // En synchrone, l'email part *pendant* la requête HTTP. Une
                // poignée de main SMTP lente fait dépasser le délai du
                // navigateur, et le client voit « connexion impossible » sur
                // une réservation pourtant enregistrée. Le symptôme accuse le
                // réseau ; la cause est ici.
                $this->alerte(
                    'QUEUE_CONNECTION vaut « sync » : les emails partent pendant la requête. '
                    .'Une réservation attend la poignée de main SMTP avant de répondre, et le '
                    .'navigateur peut abandonner avant. Mettez QUEUE_CONNECTION=database.'
                );
            } else {
                $this->ok("File d'attente en mode synchrone : aucun worker nécessaire");
            }

            return;
        }

        $this->ok("File d'attente : {$connexion}");

        if ($connexion !== 'database') {
            return;
        }

        try {
            $enAttente = DB::table('jobs')->count();
            $echoues = DB::table('failed_jobs')->count();

            // Une pile qui gonfle signale un worker absent ou arrêté : les
            // notifications sont alors empilées sans jamais être envoyées.
            if ($enAttente > 50) {
                $this->alerte("{$enAttente} tâches en attente : le worker tourne-t-il ? (php artisan queue:work)");
            } else {
                $this->ok("{$enAttente} tâche(s) en attente");
            }

            if ($echoues > 0) {
                $this->alerte("{$echoues} tâche(s) en échec (php artisan queue:failed)");
            }
        } catch (\Throwable $e) {
            $this->alerte("Table des tâches illisible : ".$e->getMessage());
        }
    }

    private function verifierMail(): void
    {
        $transport = config('mail.default');
        $expediteur = config('mail.from.address');

        $connus = array_keys(config('mail.mailers', []));

        if (! in_array($transport, $connus, true)) {
            // Erreur classique : renseigner une adresse dans MAIL_MAILER, qui
            // attend un type de transport. Tout envoi lève alors une exception.
            $this->alerte(
                "MAIL_MAILER vaut « {$transport} », qui n'est pas un transport valide. "
                .'Valeurs acceptées : '.implode(', ', $connus).'. '
                .(str_contains((string) $transport, '@')
                    ? 'Une adresse email se renseigne dans MAIL_FROM_ADDRESS, pas ici — '
                      .'pour Gmail, mettez MAIL_MAILER=smtp.'
                    : '')
            );
        } elseif ($transport === 'log') {
            $this->alerte(
                'MAIL_MAILER vaut « log » : aucun email ne part réellement. '
                .'Les confirmations de réservation et les réinitialisations de mot de passe sont inopérantes.'
            );
        } else {
            $this->ok("Transport email : {$transport}");
        }

        if (! $expediteur || str_contains($expediteur, 'example.com')) {
            $this->alerte("MAIL_FROM_ADDRESS n'est pas configurée ({$expediteur})");
        }

        $destinataire = $this->option('email');
        if (! $destinataire) {
            return;
        }

        try {
            Mail::raw(
                "Ceci est un message de test envoyé par la commande mavilla:diagnostic.\n"
                ."Si vous le recevez, la configuration email est fonctionnelle.",
                fn ($m) => $m->to($destinataire)->subject('Ma Villa — test de configuration email')
            );
            $this->ok("Message de test envoyé à {$destinataire} (vérifiez la réception, y compris les indésirables)");
        } catch (\Throwable $e) {
            $this->alerte("Envoi impossible : ".$e->getMessage());
        }
    }

    private function ok(string $message): void
    {
        $this->line("  <fg=green>✓</> {$message}");
    }

    private function alerte(string $message): void
    {
        $this->alertes++;
        $this->line("  <fg=yellow>!</> {$message}");
    }
}
