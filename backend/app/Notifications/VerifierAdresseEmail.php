<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\URL;

/**
 * Vérification d'adresse email en français.
 * Le lien signé vise l'API, qui redirige ensuite vers le front.
 */
class VerifierAdresseEmail extends VerifyEmail
{
    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Confirmez votre adresse email — Ma Villa')
            ->greeting('Bienvenue '.$notifiable->name.',')
            ->line('Confirmez votre adresse email pour sécuriser votre compte Ma Villa.')
            ->action('Confirmer mon adresse', $this->verificationUrl($notifiable))
            ->line('Si vous n\'avez pas créé de compte, ignorez cet email.');
    }

    protected function verificationUrl($notifiable): string
    {
        return URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(config('auth.verification.expire', 60)),
            [
                'id'   => $notifiable->getKey(),
                'hash' => sha1($notifiable->getEmailForVerification()),
            ]
        );
    }
}
