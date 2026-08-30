<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Email de réinitialisation, pointant vers le front (SPA) et non vers une
 * route Blade : le back n'expose aucune interface.
 */
class ReinitialiserMotDePasse extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $token) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim(config('app.frontend_url'), '/').'/reinitialiser-mot-de-passe?'.http_build_query([
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);

        $minutes = config('auth.passwords.'.config('auth.defaults.passwords').'.expire');

        return (new MailMessage)
            ->subject('Réinitialisation de votre mot de passe PasseTemps')
            ->greeting('Bonjour '.$notifiable->name.',')
            ->line('Vous avez demandé à réinitialiser votre mot de passe.')
            ->action('Choisir un nouveau mot de passe', $url)
            ->line("Ce lien expire dans {$minutes} minutes.")
            ->line('Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.');
    }
}
