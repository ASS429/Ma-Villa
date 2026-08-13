<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
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

    public function __construct(private readonly array $config)
    {
    }

    public static function depuisConfig(): self
    {
        return new self(config('paiement.paydunya'));
    }

    public function estConfigure(): bool
    {
        return ! empty($this->config['cle_maitre'])
            && ! empty($this->config['cle_privee'])
            && ! empty($this->config['token']);
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
    ): array {
        $reponse = $this->requete()->post(self::BASE_LIVE.'/checkout-invoice/create', [
            'invoice' => [
                'total_amount' => $montant,
                'description'  => $description,
                'items'        => $articles ?: (object) [],
            ],
            'store' => [
                'name'        => $this->config['boutique']['nom'],
                'tagline'     => $this->config['boutique']['description'],
                'website_url' => rtrim((string) config('app.frontend_url'), '/'),
            ],
            'custom_data' => $donneesPersonnalisees ?: (object) [],
            'actions' => [
                'callback_url' => route('paiements.ipn'),
                'return_url'   => rtrim((string) config('app.frontend_url'), '/').'/paiement/retour',
                'cancel_url'   => rtrim((string) config('app.frontend_url'), '/').'/paiement/annule',
            ],
        ]);

        $corps = $reponse->json() ?? [];

        // PayDunya répond 200 même en cas de refus : c'est `response_code` qui
        // fait foi, pas le statut HTTP.
        if (($corps['response_code'] ?? null) !== '00') {
            throw new RuntimeException(
                'Création de facture refusée : '.($corps['response_text'] ?? 'réponse illisible')
            );
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
        return $this->softpay('wave-senegal', [
            'wave_senegal_fullName'      => $nom,
            'wave_senegal_email'         => $email,
            'wave_senegal_phone'         => $this->normaliserTelephone($telephone),
            'wave_senegal_payment_token' => $jetonFacture,
        ]);
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

        $resultat['url_application'] = $resultat['brut']['other_url']['om_url'] ?? null;
        $resultat['url_maxit']       = $resultat['brut']['other_url']['maxit_url'] ?? null;

        return $resultat;
    }

    private function softpay(string $chemin, array $donnees): array
    {
        $reponse = $this->requete()->post(self::BASE_LIVE.'/softpay/'.$chemin, $donnees);
        $corps = $reponse->json() ?? [];

        if (! ($corps['success'] ?? false)) {
            throw new RuntimeException($corps['message'] ?? 'Le paiement a été refusé.');
        }

        return [
            'url'  => $corps['url'] ?? null,
            'brut' => $corps,
        ];
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

        return hash_equals(hash('sha512', (string) $this->config['cle_maitre']), $hash);
    }

    private function requete(): PendingRequest
    {
        if (! $this->estConfigure()) {
            throw new RuntimeException('Les clés PayDunya ne sont pas configurées.');
        }

        return Http::withHeaders([
            'Content-Type'          => 'application/json',
            'PAYDUNYA-MASTER-KEY'   => $this->config['cle_maitre'],
            'PAYDUNYA-PRIVATE-KEY'  => $this->config['cle_privee'],
            'PAYDUNYA-TOKEN'        => $this->config['token'],
        ])->timeout(30)->retry(2, 500, throw: false);
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
