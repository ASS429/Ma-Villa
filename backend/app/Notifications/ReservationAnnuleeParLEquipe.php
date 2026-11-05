<?php

namespace App\Notifications;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * L'équipe a annulé un séjour : remboursement enregistré, ou règlement saisi par erreur.
 * Le propriétaire préparait peut-être la venue. Le motif reste à l'équipe : il peut parler du
 * client, et l'imputation se discute avec lui à part si elle le concerne.
 */
class ReservationAnnuleeParLEquipe extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Reservation $reservation) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $r = $this->reservation->loadMissing(['logement.villa']);

        return (new MailMessage)
            ->subject('Réservation annulée — '.$r->logement->villa->nom)
            ->greeting('Bonjour '.$notifiable->name.',')
            ->line('L’équipe PasseTemps a annulé cette réservation. Ces dates sont de nouveau libres.')
            ->line('**Annonce** : '.$r->logement->villa->nom)
            ->line('**Logement** : '.$r->logement->nom)
            ->line('**Dates** : du '.$r->date_debut->format('d/m/Y').' au '.$r->date_fin->format('d/m/Y'))
            ->action('Voir mes réservations', rtrim(config('app.frontend_url'), '/').'/dashboard/reservations');
    }
}
