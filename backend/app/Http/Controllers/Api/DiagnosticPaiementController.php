<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PayDunya;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    public function __invoke(Request $request): JsonResponse
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
                'ok'      => false,
                'verdict' => $etat['paiement_actif']
                    ? 'Non. Le paiement est ouvert aux clients mais les clés manquent : chaque règlement échoue, et le client croit que sa banque refuse.'
                    : 'Non, et le paiement est fermé. Les clés PayDunya ne sont pas posées.',
            ]);
        }

        // Une facture au montant minimum, jamais payée, jamais rattachée à une
        // réservation : elle ne sert qu'à voir si PayDunya nous parle. En
        // dessous du plancher, il refuserait pour cette seule raison et
        // masquerait ce qu'on cherche à savoir.
        try {
            $facture = $this->paydunya->creerFacture(
                montant: (int) config('paiement.montant_minimum'),
                description: 'Sonde de configuration Ma Villa',
            );
        } catch (\Throwable $e) {
            return response()->json($etat + [
                'facture' => ['ok' => false, 'erreur' => $e->getMessage()],
                'ok'      => false,
                'verdict' => 'Non. PayDunya refuse de créer une facture avec ces clés — aucun encaissement ne peut aboutir.',
            ]);
        }

        $etat['facture'] = ['ok' => true, 'jeton' => $facture['token'], 'url' => $facture['url']];

        // La création de facture n'est que la moitié du parcours : SoftPay est
        // un second appel, qui peut échouer seul. Il n'est tenté que si un
        // numéro est fourni — il déclenche une demande de paiement sur ce
        // téléphone, et rien ne doit partir par surprise. Aucun débit n'a lieu
        // sans confirmation du porteur.
        $telephone = $request->query('telephone');
        if (! is_string($telephone) || $telephone === '') {
            return response()->json($etat + [
                'softpay' => ['essaye' => false, 'note' => 'Ajoutez ?telephone=77XXXXXXX&methode=wave pour tester aussi SoftPay.'],
                'ok'      => true,
                // Nuance qui compte : la facture passe, mais SoftPay est un
                // second appel qui peut échouer seul. Conclure « tout va
                // bien » sur la seule facture, c'est promettre le parcours
                // sans clic intermédiaire qu'on n'a pas vérifié.
                'verdict' => $etat['softpay_disponible']
                    ? 'Oui, PayDunya répond et crée des factures. Le parcours Wave ou Orange Money direct n\'a pas été testé — donnez un numéro pour le vérifier.'
                    : 'Oui pour la facture, mais en clés de test : le parcours direct Wave ou Orange Money n\'est pas servi, les clients passeront par la page PayDunya.',
            ]);
        }

        $methode = $request->query('methode') === 'orange_money' ? 'orange_money' : 'wave';

        try {
            $resultat = $methode === 'wave'
                ? $this->paydunya->payerAvecWave($facture['token'], 'Sonde Ma Villa', (string) $request->user()->email, $telephone)
                : $this->paydunya->payerAvecOrangeMoney($facture['token'], 'Sonde Ma Villa', (string) $request->user()->email, $telephone);

            return response()->json($etat + [
                'ok'      => true,
                'verdict' => 'Oui. La facture est créée et le paiement direct part sur le téléphone indiqué.',
                'softpay' => [
                    'essaye'          => true,
                    'methode'         => $methode,
                    'ok'              => true,
                    'url'             => $resultat['url'],
                    'url_application' => $resultat['url_application'] ?? null,
                    'url_maxit'       => $resultat['url_maxit'] ?? null,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json($etat + [
                'softpay' => ['essaye' => true, 'methode' => $methode, 'ok' => false, 'erreur' => $e->getMessage()],
                'ok'      => false,
                // Une facture qui passe et un SoftPay qui tombe est le cas le
                // plus trompeur : l'encaissement marche, mais chaque client
                // doit franchir une page de plus, et on le perd là.
                'verdict' => 'À moitié. La facture est créée, mais le paiement direct échoue : les clients devront passer par la page PayDunya.',
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
