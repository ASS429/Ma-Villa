<?php

namespace App\Providers;

use App\Services\PayDunya;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Symfony\Component\Mime\Address;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Résolu à la demande plutôt qu'en singleton : la configuration change
        // d'un test à l'autre, et un singleton figerait les clés du premier.
        $this->app->bind(PayDunya::class, fn () => PayDunya::depuisConfig());
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->poserLAdresseDeReponse();
    }

    /**
     * Fait retomber les réponses sur une boîte qui existe.
     *
     * Expédier depuis un domaine n'est pas y recevoir. Un service d'envoi
     * écrit au nom de `contact@passetemps.sn` sans qu'aucune boîte n'existe
     * derrière : le message part, arrive, et la réponse rebondit — au moment
     * précis où quelqu'un cherche de l'aide.
     *
     * `Reply-To` sépare les deux rôles : l'expéditeur porte le domaine de la
     * marque, ce que réclament SPF et DKIM ; les réponses vont ailleurs.
     *
     * ⚠️ **Surtout pas `Mail::alwaysReplyTo()` ici.** Cette méthode résout le
     * gestionnaire de courrier, donc construit le transport — et un transport
     * dont la clé manque lève au démarrage. L'application entière refuserait
     * alors de répondre, pour une en-tête d'amabilité. On écoute l'événement
     * d'envoi : rien n'est construit tant que rien ne part.
     */
    private function poserLAdresseDeReponse(): void
    {
        $adresse = config('mail.reply_to.address');

        if (blank($adresse)) {
            return;
        }

        Event::listen(function (MessageSending $evenement) use ($adresse) {
            $message = $evenement->message;

            // Un message qui porte déjà la sienne la garde : une réponse
            // dirigée exprès vaut mieux qu'un réglage global.
            if ($message->getReplyTo() !== []) {
                return;
            }

            $message->replyTo(new Address($adresse, (string) config('mail.reply_to.name')));
        });
    }
}
