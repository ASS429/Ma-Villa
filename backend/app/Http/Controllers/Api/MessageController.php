<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\Reservation;
use App\Models\User;
use App\Services\Push;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Messagerie d'une réservation.
 *
 * L'autorisation passe par `ReservationPolicy::view` : le client, le
 * propriétaire du logement, et l'admin. Cette règle existait déjà et servait
 * la fiche de réservation — la réutiliser plutôt que la réécrire garantit
 * qu'elle ne pourra pas diverger d'un écran à l'autre.
 */
class MessageController extends Controller
{
    public function __construct(private readonly Push $push)
    {
    }

    /**
     * Le fil, du plus ancien au plus récent.
     *
     * L'ouverture marque comme lus les messages **de l'autre**. Marquer les
     * siens n'aurait aucun sens : c'est le destinataire qui lit.
     */
    public function index(Request $request, Reservation $reservation): JsonResponse
    {
        $this->authorize('view', $reservation);
        $moi = $request->user();

        $reservation->messages()
            ->whereNull('lu_le')
            ->where('user_id', '!=', $moi->id)
            ->update(['lu_le' => now()]);

        return response()->json(
            $reservation->messages()->with('auteur:id,name,role')->get()
        );
    }

    public function store(Request $request, Reservation $reservation): JsonResponse
    {
        $this->authorize('view', $reservation);

        $donnees = $request->validate(
            ['corps' => 'required|string|max:2000'],
            ['corps.max' => 'Un message fait 2 000 caractères au maximum.']
        );

        // Un message vide de sens — que des espaces — encombre le fil sans rien
        // dire, et fait sonner le téléphone d'en face pour rien.
        $corps = trim($donnees['corps']);
        if ($corps === '') {
            return response()->json(['message' => 'Le message est vide.'], 422);
        }

        $moi = $request->user();

        $message = $reservation->messages()->create([
            'user_id' => $moi->id,
            'corps' => $corps,
        ]);

        $this->prevenirLeDestinataire($reservation, $moi, $corps);

        return response()->json($message->load('auteur:id,name,role'), 201);
    }

    /**
     * Le destinataire est l'autre partie : le propriétaire si c'est le client
     * qui écrit, le client sinon. Un admin qui intervient dans un litige écrit
     * au client — c'est lui qui a saisi la plateforme.
     */
    private function prevenirLeDestinataire(Reservation $reservation, User $auteur, string $corps): void
    {
        $reservation->loadMissing('client', 'logement.villa.proprietaire');

        $proprietaire = $reservation->logement?->villa?->proprietaire;
        $client = $reservation->client;

        $destinataire = $auteur->id === $client?->id ? $proprietaire : $client;

        if (! $destinataire || $destinataire->id === $auteur->id) {
            return;
        }

        // Pas d'email ici, à la différence des étapes de réservation : un
        // message est un échange, pas un jalon. Une notification par réplique
        // remplirait une boîte de réception et se ferait filtrer — au point
        // que les emails qui comptent vraiment partiraient avec.
        $this->push->versUtilisateur($destinataire, [
            'titre' => "Message de {$auteur->name}",
            'corps' => Str::limit($corps, 90),
            'url' => "/dashboard/reservations/{$reservation->id}/messages",
            // Même fil, même notification : dix répliques ne doivent pas
            // produire dix lignes dans le centre de notifications.
            'groupe' => "messages-{$reservation->id}",
        ]);
    }

    /**
     * Nombre de messages non lus, par réservation.
     *
     * Une seule requête agrégée plutôt qu'un comptage par ligne : la liste des
     * réservations en affiche autant qu'elle en montre, et cela ferait autant
     * d'allers-retours sur un serveur mono-processus.
     */
    public function nonLus(Request $request): JsonResponse
    {
        $moi = $request->user();

        $reservations = $moi->role === 'proprietaire'
            ? Reservation::whereHas('logement.villa', fn ($q) => $q->where('user_id', $moi->id))
            : Reservation::where('user_id', $moi->id);

        $compte = Message::query()
            ->selectRaw('reservation_id, COUNT(*) as total')
            ->whereIn('reservation_id', $reservations->select('id'))
            ->whereNull('lu_le')
            ->where('user_id', '!=', $moi->id)
            ->groupBy('reservation_id')
            ->pluck('total', 'reservation_id');

        return response()->json([
            'total' => (int) $compte->sum(),
            'par_reservation' => $compte,
        ]);
    }
}
