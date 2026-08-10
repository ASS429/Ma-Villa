<?php

namespace App\Notifications;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Prévient le propriétaire qu'une demande est arrivée.
 * Sans cet email, une demande peut rester sans réponse indéfiniment : le
 * propriétaire n'a aucun moyen d'apprendre son existence hors du tableau de bord.
 */
class NouvelleReservation extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Reservation $reservation) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $r = $this->reservation->loadMissing(['logement.villa', 'tarif', 'client']);

        return (new MailMessage)
            ->subject('Nouvelle demande de réservation — '.$r->logement->villa->nom)
            ->greeting('Bonjour '.$notifiable->name.',')
            ->line('Vous avez reçu une nouvelle demande de réservation.')
            ->line('**Villa** : '.$r->logement->villa->nom)
            ->line('**Logement** : '.$r->logement->nom)
            ->line('**Dates** : du '.$this->jour($r->date_debut).' au '.$this->jour($r->date_fin))
            ->line('**Voyageurs** : '.$r->nb_personnes)
            ->line('**Montant** : '.number_format((float) $r->montant_total, 0, ',', ' ').' FCFA')
            ->line('**Client** : '.$r->client->name.($r->client->phone ? ' — '.$r->client->phone : ''))
            ->action('Répondre à la demande', rtrim(config('app.frontend_url'), '/').'/dashboard/reservations')
            ->line('Merci de répondre rapidement : les clients réservent souvent plusieurs villas en parallèle.');
    }

    private function jour($date): string
    {
        return $date instanceof \DateTimeInterface ? $date->format('d/m/Y') : (string) $date;
    }
}
