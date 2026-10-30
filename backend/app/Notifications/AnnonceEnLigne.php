<?php

namespace App\Notifications;

use App\Models\Villa;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Prévient le propriétaire que son annonce est en ligne.
 *
 * Il était prévenu d'un refus ou d'un retrait, jamais de la validation : il
 * envoyait son annonce, puis n'apprenait rien. Certains revenaient vérifier,
 * d'autres concluaient qu'elle attendait encore. L'e-mail est le canal qu'il
 * lit ; la notification poussée, envoyée à côté par le contrôleur, n'en est que
 * le rappel.
 */
class AnnonceEnLigne extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Domaines sans boîte aux lettres : `passetemps.sn` n'a aucun
     * enregistrement MX (vérifié le 30/10/2026). Les comptes créés par import
     * (Clé d'Or, Virage) y portent une adresse d'attente : leur écrire, c'est
     * produire un rebond. À retirer le jour où le domaine reçoit du courrier.
     */
    private const DOMAINES_SANS_BOITE = ['passetemps.sn'];

    public function __construct(public Villa $villa) {}

    public function via(object $notifiable): array
    {
        $domaine = strtolower(substr(strrchr((string) $notifiable->email, '@') ?: '', 1));

        return in_array($domaine, self::DOMAINES_SANS_BOITE, true) ? [] : ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $site = rtrim(config('app.frontend_url'), '/');

        return (new MailMessage)
            ->subject('Votre annonce est en ligne — '.$this->villa->nom)
            ->greeting('Bonjour '.$notifiable->name.',')
            ->line('Bonne nouvelle : notre équipe a relu votre annonce, et elle est maintenant visible sur PasseTemps.')
            ->line('**Annonce** : '.$this->villa->nom.' — '.$this->villa->ville)
            ->line('Vous pouvez la modifier à tout moment depuis « Mes hébergements » : photos, logements, tarifs et dates fermées.')
            // Barre oblique finale : sans elle, Render sert le gabarit générique
            // au lieu de la page de l'annonce.
            ->action('Voir mon annonce', $site.'/hebergements/'.$this->villa->id.'/');
    }
}
