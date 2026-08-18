<?php

namespace App\Services;

use App\Models\AbonnementPush;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

/**
 * Envoi de notifications poussées.
 *
 * Une notification poussée est un *rappel*, jamais un canal de vérité : elle
 * peut ne pas partir, arriver en retard, ou être refusée par l'utilisateur.
 * Toute information qui compte — une réservation confirmée, un paiement reçu —
 * doit rester lisible dans l'application et dans l'email. Ce service ne
 * remplace donc aucune notification existante, il s'y ajoute.
 *
 * Conséquence directe : un échec ici n'interrompt jamais l'action métier en
 * cours. Il est journalisé, et c'est tout.
 */
class Push
{
    /** Vrai quand les clés VAPID sont posées et la fonction ouverte. */
    public function disponible(): bool
    {
        return config('push.actif')
            && config('push.vapid.publique') !== ''
            && config('push.vapid.privee') !== '';
    }

    public function clePublique(): string
    {
        return (string) config('push.vapid.publique');
    }

    /**
     * Notifie tous les appareils d'un utilisateur.
     *
     * @param  array<string, mixed>  $charge  Lu par le service worker : titre,
     *                                        corps, url, groupe.
     * @return int Nombre d'appareils effectivement joints.
     */
    public function versUtilisateur(?User $utilisateur, array $charge): int
    {
        if (! $utilisateur || ! $this->disponible()) {
            return 0;
        }

        return $this->versAbonnements(
            AbonnementPush::where('user_id', $utilisateur->id)->get(),
            $charge
        );
    }

    /**
     * @param  Collection<int, AbonnementPush>  $abonnements
     * @param  array<string, mixed>  $charge
     */
    public function versAbonnements(Collection $abonnements, array $charge): int
    {
        if ($abonnements->isEmpty() || ! $this->disponible()) {
            return 0;
        }

        try {
            $webPush = new WebPush([
                'VAPID' => [
                    'subject' => config('push.vapid.sujet'),
                    'publicKey' => config('push.vapid.publique'),
                    'privateKey' => config('push.vapid.privee'),
                ],
            ]);

            // Le service mono-processus ne doit pas rester bloqué sur un
            // service de poussée lent pendant qu'une réservation attend.
            $webPush->setDefaultOptions(['TTL' => 3600, 'urgency' => 'normal']);
        } catch (\Throwable $e) {
            Log::error('Web Push inutilisable', ['erreur' => $e->getMessage()]);

            return 0;
        }

        $parEndpoint = [];

        foreach ($abonnements as $abonnement) {
            if ($abonnement->estPerime()) {
                $abonnement->delete();
                continue;
            }

            try {
                $webPush->queueNotification(
                    Subscription::create([
                        'endpoint' => $abonnement->endpoint,
                        'publicKey' => $abonnement->cle_p256dh,
                        'authToken' => $abonnement->cle_auth,
                    ]),
                    json_encode($charge, JSON_UNESCAPED_UNICODE)
                );

                $parEndpoint[$abonnement->endpoint] = $abonnement;
            } catch (\Throwable $e) {
                Log::warning('Abonnement push illisible', [
                    'abonnement' => $abonnement->id,
                    'erreur' => $e->getMessage(),
                ]);
            }
        }

        $joints = 0;

        try {
            foreach ($webPush->flush() as $rapport) {
                $abonnement = $parEndpoint[$rapport->getRequest()->getUri()->__toString()] ?? null;

                if ($rapport->isSuccess()) {
                    $joints++;
                    $abonnement?->forceFill([
                        'echecs' => 0,
                        'derniere_poussee_le' => now(),
                    ])->save();

                    continue;
                }

                $this->traiterRefus($abonnement, $rapport);
            }
        } catch (\Throwable $e) {
            Log::error('Envoi des notifications interrompu', ['erreur' => $e->getMessage()]);
        }

        return $joints;
    }

    /**
     * Un abonnement disparu et un service momentanément indisponible ne se
     * traitent pas pareil : le premier se supprime, le second se réessaie.
     */
    private function traiterRefus(?AbonnementPush $abonnement, object $rapport): void
    {
        if (! $abonnement) {
            return;
        }

        // 404 / 410 : le navigateur a révoqué l'abonnement. Le garder
        // reviendrait à réessayer indéfiniment une adresse morte.
        if (method_exists($rapport, 'isSubscriptionExpired') && $rapport->isSubscriptionExpired()) {
            $abonnement->delete();

            return;
        }

        $abonnement->increment('echecs');

        if ($abonnement->echecs >= (int) config('push.echecs_avant_retrait')) {
            Log::info('Abonnement push retiré après échecs répétés', ['abonnement' => $abonnement->id]);
            $abonnement->delete();
        }
    }
}
