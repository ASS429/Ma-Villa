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
    private const BASE_TEST = 'https://app.paydunya.com/sandbox-api/v1';

    public function __construct(private readonly array $config)
    {
    }

    /**
     * Les clés de test (`test_private_…`) ne valent que sur le bac à sable, et
     * les clés de production que sur l'API réelle : les croiser fait échouer la
     * création de facture avec un message qui n'évoque jamais le mode.
     */
    private function base(): string
    {
        return ($this->config['mode'] ?? 'test') === 'live'
            ? self::BASE_LIVE
            : self::BASE_TEST;
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
     * Vrai quand aucun franc réel ne peut transiter — soit le mode l'annonce,
     * soit les clés le trahissent.
     *
     * Sert à décider si la cause d'un refus peut être montrée. Se fier au seul
     * mode laissait muet le cas qu'on a le plus besoin de diagnostiquer :
     * `PAYDUNYA_MODE=live` posé par erreur sur des clés de test.
     */
    public function sansEncaissementReel(): bool
    {
        return ($this->config['mode'] ?? 'test') !== 'live' || $this->clesDeTest();
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
        $reponse = $this->requete()->post($this->base().'/softpay/'.$chemin, $donnees);
        $corps = $reponse->json() ?? [];

        if (! ($corps['success'] ?? false)) {
            throw new RuntimeException(sprintf(
                'PayDunya a refusé le paiement %s : %s',
                $chemin,
                $corps['message'] ?? json_encode($corps) ?: 'réponse illisible'
            ));
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

        return hash_equals(hash('sha512', $this->cle('cle_maitre')), $hash);
    }

    private function requete(): PendingRequest
    {
        if (! $this->estConfigure()) {
            throw new RuntimeException('Les clés PayDunya ne sont pas configurées.');
        }

        // Router silencieusement vers le bac à sable serait pire que d'échouer :
        // on croirait encaisser sans qu'aucun franc n'arrive. Le mode déclaré
        // fait donc foi, et l'incohérence se dit.
        if (($this->config['mode'] ?? 'test') === 'live' && $this->clesDeTest()) {
            throw new RuntimeException(
                'PAYDUNYA_MODE vaut « live » mais les clés fournies sont des clés de test '
                .'(« test_… »), que l\'API réelle refuse. Mettez PAYDUNYA_MODE=test pour '
                .'tester, ou renseignez vos clés de production pour encaisser.'
            );
        }

        return Http::withHeaders([
            'Content-Type'          => 'application/json',
            'PAYDUNYA-MASTER-KEY'   => $this->cle('cle_maitre'),
            'PAYDUNYA-PRIVATE-KEY'  => $this->cle('cle_privee'),
            'PAYDUNYA-TOKEN'        => $this->cle('token'),
        ])->timeout(30)->retry(2, 500, throw: false);
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
