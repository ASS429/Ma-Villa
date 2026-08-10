<?php

namespace App\Notifications;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Prévient le client que sa demande a été acceptée ou refusée.
 */
class ReservationMiseAJour extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Reservation $reservation) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $r = $this->reservation->loadMissing(['logement.villa', 'tarif']);
        $villa = $r->logement->villa;
        $confirmee = $r->statut === 'confirmee';

        $mail = (new MailMessage)
            ->subject(($confirmee ? 'Réservation confirmée' : 'Réservation annulée').' — '.$villa->nom)
            ->greeting('Bonjour '.$notifiable->name.',');

        if ($confirmee) {
            $mail->line('Bonne nouvelle : votre réservation est confirmée.');
        } else {
            $mail->line('Votre réservation a été annulée.')
                 ->line('Si vous n\'êtes pas à l\'origine de cette annulation, le propriétaire n\'a pas pu honorer la demande.');
        }

        $mail->line('**Villa** : '.$villa->nom.' — '.$villa->ville)
             ->line('**Logement** : '.$r->logement->nom)
             ->line('**Dates** : du '.$this->jour($r->date_debut).' au '.$this->jour($r->date_fin))
             ->line('**Montant** : '.number_format((float) $r->montant_total, 0, ',', ' ').' FCFA');

        if ($confirmee) {
            $mail->line('**Contact du propriétaire** : '.$villa->telephone)
                 ->action('Voir ma réservation', rtrim(config('app.frontend_url'), '/').'/dashboard/reservations');
        } else {
            $mail->action('Chercher une autre villa', rtrim(config('app.frontend_url'), '/').'/villas');
        }

        return $mail;
    }

    private function jour($date): string
    {
        return $date instanceof \DateTimeInterface ? $date->format('d/m/Y') : (string) $date;
    }
}
