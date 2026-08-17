<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Client PayDunya — encaissement en deux temps.
 *
 * 1. `creerFacture()` obtient un jeton de facture.
 * 2. `payerAvec…()` déclenche le paiement sur le moyen choisi, et renvoie une
 *    URL vers laquelle rediriger le payeur.
 *
 * La confirmation ne vient jamais de cette réponse : elle arrive plus tard sur
 * l'IPN. Le temps que le client tape son code sur son téléphone, la requête HTTP
 * est terminée depuis longtemps — considérer la réponse comme un succès
 * offrirait des réservations gratuites à qui abandonne au dernier écran.
 */
class PayDunya
{
    private const BASE_LIVE = 'https://app.paydunya.com/api/v1';
    private const BASE_TEST = 'https://app.paydunya.com/sandbox-api/v1';

    public function __construct(private readonly array $config)
    {
    }

    /**
     * Chaque jeu de clés a sa base, et une seule.
     *
     * Relevé le 17 août 2026, après avoir essayé les deux :
     *
     *   api/v1 + clés de test  → 1001 « LIVE Private Key and Token combination
     *                            is invalid »
     *   sandbox-api/v1         → accepte les clés de test
     *   sandbox-api/v1/softpay → 404, l'endpoint n'y existe pas
     *   api/v1/softpay         → existe
     *
     * La base est donc déduite des **clés**, seule chose que PayDunya valide
     * réellement — un réglage déclaratif pourrait la contredire.
     */
    private function base(): string
    {
        if ($surcharge = $this->config['base_url'] ?? null) {
            return rtrim((string) $surcharge, '/');
        }

        return $this->clesDeTest() ? self::BASE_TEST : self::BASE_LIVE;
    }

    /**
     * SoftPay n'est pas servi par le bac à sable : il ne peut pas être essayé
     * avec des clés de test. Ce n'est pas une panne à contourner, c'est une
     * limite de la plateforme — le repli sur la page de paiement est alors le
     * parcours normal, pas un incident.
     */
    public function softpayDisponible(): bool
    {
        return ! $this->clesDeTest();
    }

    public static function depuisConfig(): self
    {
        return new self(config('paiement.paydunya'));
    }

    public function estConfigure(): bool
    {
        return $this->cle('cle_maitre') !== ''
            && $this->cle('cle_privee') !== ''
            && $this->cle('token') !== '';
    }

    /** Les clés de test PayDunya se reconnaissent à leur préfixe. */
    public function clesDeTest(): bool
    {
        return str_starts_with($this->cle('cle_privee'), 'test_');
    }

    /**
     * Vrai quand aucun franc réel ne peut transiter.
     *
     * Décidé par les clés seules. Un réglage déclaratif se met à jour à la
     * main, donc en retard : brancher des clés de production en oubliant
     * `PAYDUNYA_MODE` exposerait le message du prestataire — nos clés, notre
     * boutique — dans le navigateur de vrais clients. Les clés, elles, ne
     * peuvent pas mentir sur ce qu'elles encaissent.
     */
    public function sansEncaissementReel(): bool
    {
        return $this->clesDeTest();
    }

    /**
     * Crée la facture et renvoie son jeton.
     *
     * `custom_data` nous revient tel quel dans l'IPN : c'est par là qu'on
     * retrouve la réservation concernée sans faire confiance à un identifiant
     * transmis par le navigateur du client.
     */
    public function creerFacture(
        int $montant,
        string $description,
        array $articles = [],
        array $donneesPersonnalisees = [],
        ?string $urlRetour = null,
        ?string $urlAnnulation = null,
    ): array {
        $front = rtrim((string) config('app.frontend_url'), '/');

        $reponse = $this->requete()->post($this->base().'/checkout-invoice/create', [
            'invoice' => [
                'total_amount' => $montant,
                'description'  => $description,
                'items'        => $articles ?: (object) [],
            ],
            'store' => [
                'name'        => $this->config['boutique']['nom'],
                'tagline'     => $this->config['boutique']['description'],
                'website_url' => $front,
            ],
            'custom_data' => $donneesPersonnalisees ?: (object) [],
            'actions' => [
                'callback_url' => route('paiements.ipn'),
                // Ramener le payeur sur son propre tunnel, qui interroge le
                // serveur jusqu'à l'IPN. Une page générique le laisserait
                // ignorer si son paiement a été pris en compte.
                'return_url'   => $urlRetour ?? $front,
                'cancel_url'   => $urlAnnulation ?? $urlRetour ?? $front,
            ],
        ]);

        $corps = $reponse->json() ?? [];

        // PayDunya répond 200 même en cas de refus : c'est `response_code` qui
        // fait foi, pas le statut HTTP.
        if (($corps['response_code'] ?? null) !== '00') {
            // Le code accompagne le texte : « 1001 » désigne une clé maîtresse
            // refusée, ce qu'un message seul laisse deviner.
            throw new RuntimeException(sprintf(
                'PayDunya a refusé la facture (code %s, mode %s) : %s',
                $corps['response_code'] ?? 'absent',
                $this->config['mode'] ?? 'test',
                $corps['response_text'] ?? 'réponse illisible'
            ));
        }

        return [
            'token'   => $corps['token'],
            'url'     => $corps['response_text'],
            'brut'    => $corps,
        ];
    }

    /**
     * Wave Sénégal — renvoie une URL de paiement à ouvrir.
     */
    public function payerAvecWave(string $jetonFacture, string $nom, string $email, string $telephone): array
    {
        $resultat = $this->softpay('wave-senegal', [
            'wave_senegal_fullName'      => $nom,
            'wave_senegal_email'         => $email,
            'wave_senegal_phone'         => $this->normaliserTelephone($telephone),
            'wave_senegal_payment_token' => $jetonFacture,
        ]);

        // Wave sert le même lien aux deux usages : sur téléphone il ouvre
        // l'application, sur ordinateur il ouvre une page scannable.
        $resultat['url_application'] = $resultat['url'];

        return $resultat;
    }

    /**
     * Orange Money Sénégal — renvoie une page à QR code, plus des liens
     * directs vers les applications Orange Money et Maxit, qui évitent au
     * payeur sur téléphone de scanner son propre écran.
     */
    public function payerAvecOrangeMoney(string $jetonFacture, string $nom, string $email, string $telephone): array
    {
        $resultat = $this->softpay('new-orange-money-senegal', [
            'customer_name'  => $nom,
            'customer_email' => $email,
            'phone_number'   => $this->normaliserTelephone($telephone),
            'invoice_token'  => $jetonFacture,
        ]);

        $om    = $resultat['brut']['other_url']['om_url'] ?? null;
        $maxit = $resultat['brut']['other_url']['maxit_url'] ?? null;
        $page  = $resultat['url']; // page à QR code de PayDunya

        // Maxit d'abord, et ce n'est pas un détail de préférence : `om_url`
        // pointe vers un domaine `page.link`, c'est-à-dire Firebase Dynamic
        // Links, éteint par Google en août 2025. Ces liens ne résolvent plus.
        // `maxit_url` est une URL HTTPS ordinaire, qui s'ouvre au scan comme au
        // clic. Le lien de secours reste exposé si PayDunya le remet en service.
        $meilleur = $maxit ?? $om ?? $page;

        $resultat['url_application'] = $meilleur;
        $resultat['url']             = $meilleur; // cible du code QR
        $resultat['url_maxit']       = $maxit;
        $resultat['url_om']          = $om;
        $resultat['url_page']        = $page;

        return $resultat;
    }

    private function softpay(string $chemin, array $donnees): array
    {
        $reponse = $this->requete()->post($this->base().'/softpay/'.$chemin, $donnees);
        $corps = $reponse->json() ?? [];

        if (! ($corps['success'] ?? false)) {
            // Le statut HTTP et le corps brut, pas seulement le JSON décodé :
            // un corps vide peut être un 404 (service non ouvert sur ce compte),
            // un 403 (clés refusées) ou un 200 sans contenu, et ces trois-là se
            // corrigent à trois endroits différents.
            // Le corps brut accompagne toujours le message : PayDunya loge
            // parfois la vraie cause dans `errors`, que `message` ne résume pas.
            // Se contenter du résumé a déjà coûté un aller-retour.
            $brut = trim((string) $reponse->body());
            $resume = $corps['message'] ?? $corps['response_text'] ?? null;

            throw new RuntimeException(sprintf(
                'PayDunya a refusé le paiement %s (HTTP %d) : %s',
                $chemin,
                $reponse->status(),
                is_string($resume) && $resume !== ''
                    ? $resume.' — réponse : '.mb_substr($brut, 0, 400)
                    : ($brut !== '' ? mb_substr($brut, 0, 400) : 'réponse vide')
            ));
        }

        return [
            'url'  => $this->premiereUrl($corps, ['url', 'redirect_url', 'payment_url', 'launch_url', 'response_text']),
            'brut' => $corps,
        ];
    }

    /**
     * PayDunya ne loge pas l'URL de paiement au même endroit selon le moyen et
     * la version de l'API. Lire un seul champ suffisait à se retrouver sans
     * rien à afficher — ni lien à ouvrir, ni code à scanner — pour un paiement
     * pourtant accepté.
     *
     * @param array<string, mixed> $corps
     * @param list<string> $chemins
     */
    private function premiereUrl(array $corps, array $chemins): ?string
    {
        foreach ($chemins as $chemin) {
            $valeur = data_get($corps, $chemin);

            if (is_string($valeur) && filter_var($valeur, FILTER_VALIDATE_URL)) {
                return $valeur;
            }
        }

        return null;
    }

    /**
     * Redemande à PayDunya l'état d'une facture.
     *
     * C'est la seule source de vérité réellement fiable : l'IPN est un POST sur
     * une URL publique, tandis que ceci est un appel sortant vers PayDunya,
     * authentifié par nos clés. Sert à deux choses — vérifier une notification
     * avant d'y croire, et suivre un paiement quand la notification n'arrive
     * jamais, ce qui est le cas courant en bac à sable.
     *
     * Renvoie `null` si PayDunya n'a pas répondu : ne rien savoir doit rester
     * distinct de « pas encore payé ».
     */
    public function statutFacture(string $jetonFacture): ?array
    {
        try {
            // Ni reprise ni long délai : cette méthode est appelée en boucle
            // par l'écran d'attente, et le serveur applicatif est mono-processus.
            $reponse = Http::withHeaders($this->entetes())
                ->timeout(10)
                ->get($this->base().'/checkout-invoice/confirm/'.$jetonFacture);

            $corps = $reponse->json() ?? [];

            if (! $reponse->successful() || ! isset($corps['status'])) {
                Log::warning('Statut de facture illisible', [
                    'http'   => $reponse->status(),
                    'reponse' => $corps['response_text'] ?? null,
                ]);

                return null;
            }

            return [
                'statut'      => $corps['status'],
                'montant'     => $corps['invoice']['total_amount'] ?? null,
                'personnalise' => $corps['custom_data'] ?? [],
                'brut'        => $corps,
            ];
        } catch (\Throwable $e) {
            Log::warning('Statut de facture injoignable', ['erreur' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * Vérifie qu'une notification vient bien de PayDunya.
     *
     * Le hash transmis est le SHA-512 de la clé maîtresse. Sans cette
     * vérification, n'importe qui pourrait annoncer « paiement réussi » sur
     * l'IPN et s'offrir une réservation : c'est le seul rempart, car l'IPN est
     * une URL publique.
     */
    public function notificationAuthentique(?string $hash): bool
    {
        if (! $hash || ! $this->estConfigure()) {
            return false;
        }

        return hash_equals(hash('sha512', $this->cle('cle_maitre')), $hash);
    }

    private function requete(): PendingRequest
    {
        if (! $this->estConfigure()) {
            throw new RuntimeException('Les clés PayDunya ne sont pas configurées.');
        }

        // Le danger n'est pas un refus — l'API accepte les clés de test et joue
        // la transaction pour de faux. C'est qu'on se croie en train
        // d'encaisser : des réservations se confirment, aucun franc n'arrive.
        // Laisser passer en silence serait la pire des options.
        if (($this->config['mode'] ?? 'test') === 'live' && $this->clesDeTest()) {
            throw new RuntimeException(
                'PAYDUNYA_MODE vaut « live » mais les clés fournies sont des clés de test '
                .'(« test_… ») : aucun paiement réel ne serait encaissé, alors que les '
                .'réservations se confirmeraient. Mettez PAYDUNYA_MODE=test pour tester, '
                .'ou renseignez vos clés de production pour encaisser.'
            );
        }

        return Http::withHeaders($this->entetes())
            ->timeout(30)
            ->retry(2, 500, throw: false);
    }

    /** @return array<string, string> */
    private function entetes(): array
    {
        return [
            'Content-Type'         => 'application/json',
            'PAYDUNYA-MASTER-KEY'  => $this->cle('cle_maitre'),
            'PAYDUNYA-PUBLIC-KEY'  => $this->cle('cle_publique'),
            'PAYDUNYA-PRIVATE-KEY' => $this->cle('cle_privee'),
            'PAYDUNYA-TOKEN'       => $this->cle('token'),
        ];
    }

    /**
     * Les clés sont recopiées à la main dans le tableau de bord d'un hébergeur :
     * un espace ou un retour à la ligne au bout suffit à faire répondre
     * « Invalid Masterkey Specified », ou à faire rejeter toutes les IPN dont
     * la signature ne correspondra plus. Rien ne le laisse voir.
     */
    private function cle(string $nom): string
    {
        return trim((string) ($this->config[$nom] ?? ''));
    }

    /**
     * PayDunya attend un numéro local à neuf chiffres : « +221 77 123 45 67 »
     * saisi par un client serait refusé tel quel.
     */
    private function normaliserTelephone(string $telephone): string
    {
        $chiffres = preg_replace('/\D+/', '', $telephone);

        if (str_starts_with($chiffres, '221')) {
            $chiffres = substr($chiffres, 3);
        }

        return $chiffres;
    }
}
