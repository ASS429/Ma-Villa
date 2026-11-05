<?php

namespace App\Notifications;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Le premier règlement d'un séjour est arrivé chez PasseTemps : les dates sont prises, et le
 * propriétaire doit préparer la venue. Ni montant ni part ici : ils bougent tant que le séjour
 * n'est pas soldé, et son espace dit ce qui lui revient. Le numéro du client, lui, y a sa place :
 * le séjour est engagé, et c'est la règle de son espace réservations.
 */
class ReservationConfirmeeParLEquipe extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Reservation $reservation) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $r = $this->reservation->loadMissing(['logement.villa', 'client']);

        $mail = (new MailMessage)
            ->subject('Réservation confirmée — '.$r->logement->villa->nom)
            ->greeting('Bonjour '.$notifiable->name.',')
            ->line('Un client a réservé auprès de l’équipe PasseTemps. Ces dates sont maintenant prises.')
            ->line('**Annonce** : '.$r->logement->villa->nom)
            ->line('**Logement** : '.$r->logement->nom)
            ->line('**Dates** : du '.$r->date_debut->format('d/m/Y').' au '.$r->date_fin->format('d/m/Y'))
            ->line('**Voyageurs** : '.$r->nb_personnes)
            ->line('**Client** : '.$r->client->name);

        if ($r->client->phone) {
            $mail->line('**Téléphone** : '.$r->client->phone);
        }

        return $mail
            ->action('Voir mes réservations', rtrim(config('app.frontend_url'), '/').'/dashboard/reservations')
            ->line('L’argent est reçu par PasseTemps : votre part vous est versée après le séjour.');
    }
}
