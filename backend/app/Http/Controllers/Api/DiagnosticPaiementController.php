<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PayDunya;
use Illuminate\Http\JsonResponse;

/**
 * Sonde l'intégration PayDunya sans passer par une réservation.
 *
 * Une fois les clés de production en place, la cause d'un refus n'est plus
 * montrée au payeur — c'est ce qu'il faut pour un client, mais cela aveugle
 * celui qui teste son propre encaissement. Il ne restait que les journaux de
 * l'hébergeur, difficiles d'accès.
 *
 * Réservé aux administrateurs : la réponse nomme le prestataire, la boutique
 * et parfois la raison d'un refus de clés.
 */
class DiagnosticPaiementController extends Controller
{
    public function __construct(private readonly PayDunya $paydunya)
    {
    }

    public function __invoke(): JsonResponse
    {
        $etat = [
            'paiement_actif'     => (bool) config('paiement.actif'),
            'mode_declare'       => config('paiement.paydunya.mode'),
            'cles'               => $this->empreintesDesCles(),
            'softpay_disponible' => $this->paydunya->softpayDisponible(),
            'repli_checkout'     => (bool) config('paiement.repli_checkout'),
        ];

        if (! $this->paydunya->estConfigure()) {
            return response()->json($etat + [
                'facture' => ['ok' => false, 'erreur' => 'Clés incomplètes : master, privée et token sont requis.'],
            ]);
        }

        // Une facture de 100 F, jamais payée, jamais rattachée à une
        // réservation : elle ne sert qu'à voir si PayDunya nous parle.
        try {
            $facture = $this->paydunya->creerFacture(
                montant: 100,
                description: 'Sonde de configuration Ma Villa',
            );

            return response()->json($etat + [
                'facture' => [
                    'ok'    => true,
                    'jeton' => $facture['token'],
                    'url'   => $facture['url'],
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json($etat + [
                'facture' => ['ok' => false, 'erreur' => $e->getMessage()],
            ]);
        }
    }

    /**
     * De quoi reconnaître un jeu de clés sans jamais le divulguer : son
     * préfixe, sa longueur, et s'il traîne une espace au bout — la panne la
     * plus courante et la moins visible.
     *
     * @return array<string, array<string, mixed>>
     */
    private function empreintesDesCles(): array
    {
        $cles = [
            'maitre'   => config('paiement.paydunya.cle_maitre'),
            'privee'   => config('paiement.paydunya.cle_privee'),
            'publique' => config('paiement.paydunya.cle_publique'),
            'token'    => config('paiement.paydunya.token'),
        ];

        return array_map(fn ($valeur) => [
            'renseignee'      => (string) $valeur !== '',
            'debut'           => mb_substr((string) $valeur, 0, 5),
            'longueur'        => mb_strlen(trim((string) $valeur)),
            'espaces_au_bout' => trim((string) $valeur) !== (string) $valeur,
        ], $cles);
    }
}
