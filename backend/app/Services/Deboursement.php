<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Client PayDunya — déboursement (API « PER », v2).
 *
 * Envoie l'argent **vers** un propriétaire, là où {@see PayDunya} l'encaisse.
 * Trois appels, dans cet ordre :
 *
 *   1. `initier()`   → un jeton. La transaction est « created » : **rien n'a
 *                      bougé**. C'est ce qui rend cet appel sûr à tester.
 *   2. `soumettre()` → l'exécution. C'est ici que l'argent part.
 *   3. `statut()`    → la vérité, à toute heure.
 *
 * ⚠️ **La réponse de `soumettre()` n'est pas une preuve.** PayDunya le dit
 * explicitement : hors code « 00 », il faut interroger `check-status` avec le
 * même jeton avant de conclure quoi que ce soit. Un « failed » supposé sur un
 * virement réellement parti se solderait par un second virement.
 *
 * Même règle que pour l'encaissement, où l'IPN n'a jamais fait foi : la seule
 * source de vérité est l'API interrogée par nous, avec nos clés.
 */
class Deboursement
{
    public function __construct(private readonly PayDunya $paydunya)
    {
    }

    public static function depuisConfig(): self
    {
        return new self(PayDunya::depuisConfig());
    }

    /** Le déboursement automatique est-il branché et utilisable ? */
    public function disponible(): bool
    {
        return (bool) config('paiement.reversement.automatique')
            && $this->paydunya->estConfigure();
    }

    /**
     * Le `withdraw_mode` correspondant à un de nos moyens, s'il en existe un.
     *
     * `virement` et `especes` n'en ont pas : ils n'existent qu'hors ligne.
     */
    public function modeDeRetrait(string $methode): ?string
    {
        return config("paiement.reversement.modes.{$methode}");
    }

    /**
     * Le numéro tel que PayDunya l'attend : chiffres seuls, sans indicatif.
     *
     * Les comptes portent « +221 77 123 45 67 » ; l'API veut « 771234567 ».
     * Rien dans la réponse ne dirait qu'un numéro mal formé a été refusé pour
     * cette raison — d'où le nettoyage ici plutôt qu'à l'appel.
     */
    public function numeroPourApi(?string $telephone): ?string
    {
        $chiffres = preg_replace('/\D+/', '', (string) $telephone) ?? '';
        $indicatif = (string) config('paiement.reversement.indicatif');

        if ($indicatif !== '' && str_starts_with($chiffres, $indicatif)) {
            $chiffres = substr($chiffres, strlen($indicatif));
        }

        // Un numéro sénégalais fait neuf chiffres. En deçà, l'appel partirait
        // pour rien — et surtout, vers un compte que personne ne contrôle.
        return strlen($chiffres) >= 9 ? $chiffres : null;
    }

    /**
     * Étape 1 — obtient un jeton de déboursement. Aucun franc ne bouge.
     *
     * @return array{ok: bool, jeton?: string, code?: string, message?: string, brut: array}
     */
    public function initier(int $montant, string $numero, string $modeDeRetrait, string $urlRappel): array
    {
        $reponse = $this->appel('get-invoice', [
            'account_alias' => $numero,
            // Le montant doit être entier : le FCFA n'a pas de subdivision, et
            // une décimale fait refuser la requête.
            'amount'        => $montant,
            'withdraw_mode' => $modeDeRetrait,
            'callback_url'  => $urlRappel,
        ]);

        $corps = $reponse['corps'];
        $code = (string) ($corps['response_code'] ?? '');

        if ($code === '00' && ! empty($corps['disburse_token'])) {
            return ['ok' => true, 'jeton' => $corps['disburse_token'], 'code' => $code, 'brut' => $corps];
        }

        return [
            'ok'      => false,
            'code'    => $code,
            'message' => $this->messageLisible($code, $corps),
            'brut'    => $corps,
        ];
    }

    /**
     * Étape 2 — exécute le déboursement. **L'argent part ici.**
     *
     * `disburse_id` est notre propre référence, et PayDunya refuse de la
     * rejouer : c'est notre garde-fou contre un double virement si la requête
     * est relancée. Un « déjà utilisé » n'est donc pas un échec — c'est la
     * preuve que le premier envoi existe, et il faut aller lire son statut.
     *
     * @return array{statut: string, message: ?string, brut: array}
     */
    public function soumettre(string $jeton, ?string $reference = null): array
    {
        $charge = ['disburse_invoice' => $jeton];
        if ($reference !== null) {
            $charge['disburse_id'] = $reference;
        }

        $reponse = $this->appel('submit-invoice', $charge);
        $corps = $reponse['corps'];
        $code = (string) ($corps['response_code'] ?? '');

        // Hors « 00 », la réponse ne dit rien de fiable sur ce qui est parti.
        // C'est la consigne de PayDunya, et la seule lecture prudente.
        if ($code !== '00') {
            $verifie = $this->statut($jeton);

            return [
                'statut'  => $verifie['statut'] ?? 'inconnu',
                'message' => $this->messageLisible($code, $corps),
                'brut'    => ['soumission' => $corps, 'verification' => $verifie['brut'] ?? null],
            ];
        }

        // Certains moyens renvoient « success » sans champ `status` explicite :
        // le code « 00 » avec un texte de réussite en tient lieu.
        $statut = strtolower((string) ($corps['status'] ?? 'success'));

        return [
            'statut'  => $this->normaliser($statut),
            'message' => $corps['description'] ?? $corps['response_text'] ?? null,
            'brut'    => $corps,
        ];
    }

    /**
     * Étape 3 — l'état réel d'un déboursement.
     *
     * @return array{statut: ?string, brut: array}
     */
    public function statut(string $jeton): array
    {
        $reponse = $this->appel('check-status', ['disburse_invoice' => $jeton]);
        $corps = $reponse['corps'];

        $statut = isset($corps['status']) ? $this->normaliser((string) $corps['status']) : null;

        return ['statut' => $statut, 'brut' => $corps];
    }

    /**
     * Vérifie qu'un rappel vient bien de PayDunya.
     *
     * Le hash est le SHA-512 de la clé maîtresse — le même mécanisme que pour
     * l'encaissement. L'URL de rappel étant publique, c'est le seul rempart :
     * sans elle, n'importe qui annoncerait « versement réussi » et solderait
     * une dette qui n'a jamais été payée.
     */
    public function rappelAuthentique(?string $hash): bool
    {
        return $this->paydunya->notificationAuthentique($hash);
    }

    /* ── Interne ─────────────────────────────────────────────────── */

    /** Nos quatre états, depuis ceux de PayDunya. */
    private function normaliser(string $statut): string
    {
        return match (strtolower($statut)) {
            'success'   => 'reussi',
            'failed'    => 'echoue',
            'pending'   => 'en_cours',
            'created'   => 'cree',
            default     => 'inconnu',
        };
    }

    /**
     * Les codes d'erreur documentés, traduits. Un « 4002 » brut dans un journal
     * n'apprend rien à qui le lira dans six mois.
     */
    private function messageLisible(string $code, array $corps): string
    {
        $texte = (string) ($corps['response_text'] ?? '');

        return match ($code) {
            '401'  => "PayDunya refuse l'initiation : l'option Paiement Et Redistribution "
                     ."(PER / déboursement) n'est pas activée sur le compte marchand.",
            '4002' => $texte !== '' ? $texte
                     : "Solde insuffisant sur le compte PayDunya, ou URL de rappel injoignable.",
            '1001' => "Ce moyen de retrait n'est pas pris en charge par PayDunya.",
            '5000' => $texte !== '' ? $texte
                     : 'PayDunya signale une erreur de son côté, ou une référence déjà employée.',
            default => $texte !== '' ? $texte : "PayDunya n'a pas répondu comme attendu (code {$code}).",
        };
    }

    /**
     * Un appel à l'API de déboursement.
     *
     * Aucune reprise automatique, à la différence de l'encaissement : rejouer
     * une requête qui envoie de l'argent est exactement ce qu'il ne faut pas
     * faire. Une panne réseau laisse un état inconnu, que `check-status`
     * tranchera — jamais un second envoi à l'aveugle.
     *
     * @return array{corps: array, http: int}
     */
    private function appel(string $chemin, array $charge): array
    {
        try {
            $reponse = Http::withHeaders($this->paydunya->entetesPubliques())
                ->timeout(30)
                ->post($this->base().'/disburse/'.$chemin, $charge);

            $corps = $reponse->json() ?? [];

            if (! $reponse->successful()) {
                Log::warning('Déboursement PayDunya en erreur', [
                    'chemin' => $chemin,
                    'http'   => $reponse->status(),
                    'code'   => $corps['response_code'] ?? null,
                ]);
            }

            return ['corps' => is_array($corps) ? $corps : [], 'http' => $reponse->status()];
        } catch (\Throwable $e) {
            Log::error('Déboursement PayDunya injoignable', [
                'chemin' => $chemin,
                'erreur' => $e->getMessage(),
            ]);

            return ['corps' => ['response_code' => 'reseau', 'response_text' => $e->getMessage()], 'http' => 0];
        }
    }

    /**
     * Le déboursement vit en v2, quand l'encaissement est en v1.
     *
     * La base reste déduite des clés — c'est elle qui décide du bac à sable —
     * et seul le numéro de version change.
     */
    private function base(): string
    {
        return preg_replace('#/v1$#', '/v2', $this->paydunya->baseApi()) ?? $this->paydunya->baseApi();
    }
}
