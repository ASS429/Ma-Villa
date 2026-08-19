<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reversement;
use App\Services\Deboursement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Sonde le déboursement PayDunya, sans envoyer un franc.
 *
 * Elle répond à la seule question qui compte tant que l'option n'est pas
 * ouverte : **PayDunya accepte-t-il enfin nos initiations ?**
 *
 * C'est sans danger, et ce n'est pas un hasard : l'API de déboursement se
 * déroule en deux temps, et `get-invoice` ne fait que réserver un jeton. La
 * documentation est formelle — le statut reste « created » et ne change que
 * si l'on pousse ensuite `submit-invoice`, ce que cette sonde ne fait jamais.
 *
 * Réservée aux administrateurs : la réponse nomme le prestataire et peut
 * révéler l'état du solde marchand.
 */
class DiagnosticReversementController extends Controller
{
    public function __construct(private readonly Deboursement $deboursement)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $etat = [
            'automatique_actif' => (bool) config('paiement.reversement.automatique'),
            'montant_minimum'   => (int) config('paiement.reversement.montant_minimum'),
            'moyens'            => config('paiement.reversement.modes'),
            'url_rappel'        => route('reversements.rappel'),
        ];

        if (! config('paiement.reversement.automatique')) {
            return response()->json($etat + [
                'initiation' => [
                    'ok' => false,
                    'verdict' => 'REVERSEMENT_AUTOMATIQUE est à false : tous les versements se font à la main. '
                               .'La sonde ne teste rien tant que le réglage n\'est pas levé.',
                ],
            ]);
        }

        // Le numéro sondé est celui de la boutique si on en a un, sinon un
        // numéro sénégalais bien formé : ce qu'on teste ici est l'autorisation,
        // pas le destinataire — et sans soumission, rien ne peut lui parvenir.
        $numero = $this->deboursement->numeroPourApi(
            $request->string('numero')->toString() ?: '770000000'
        );

        if (! $numero) {
            return response()->json($etat + [
                'initiation' => ['ok' => false, 'verdict' => 'Numéro de test invalide.'],
            ]);
        }

        try {
            $initiation = $this->deboursement->initier(
                montant: (int) config('paiement.reversement.montant_minimum'),
                numero: $numero,
                modeDeRetrait: 'wave-senegal',
                urlRappel: route('reversements.rappel'),
            );
        } catch (\Throwable $e) {
            return response()->json($etat + [
                'initiation' => ['ok' => false, 'verdict' => $e->getMessage()],
            ]);
        }

        return response()->json($etat + [
            'initiation' => [
                'ok'      => $initiation['ok'],
                'code'    => $initiation['code'] ?? null,
                'verdict' => $this->verdict($initiation),
                // Le jeton n'est pas soumis : il expirera sans effet. Il est
                // rendu pour qu'on puisse le donner au support PayDunya.
                'jeton'   => $initiation['jeton'] ?? null,
            ],
            'en_cours' => Reversement::where('statut', 'en_cours')->count(),
            'echoues'  => Reversement::where('statut', 'echoue')->count(),
        ]);
    }

    /**
     * Traduit la réponse en une phrase qui dit quoi faire.
     *
     * Un code brut dans une console n'apprend rien : c'est la leçon de la
     * sonde d'encaissement, où « 1001 » ne disait pas que les clés de test
     * avaient été envoyées à l'API de production.
     */
    private function verdict(array $initiation): string
    {
        if ($initiation['ok']) {
            return 'PayDunya accepte les initiations : le déboursement automatique est opérationnel. '
                 .'Le jeton créé n\'a pas été soumis, donc aucun argent n\'a bougé.';
        }

        return match ($initiation['code'] ?? '') {
            '401'  => 'L\'option « Paiement Et Redistribution » (PER / déboursement) n\'est toujours pas '
                     .'activée sur le compte marchand. À demander au support PayDunya, pour WebPay et MobPay.',
            '4002' => 'Initiation autorisée, mais refusée : soit le solde du compte marchand est insuffisant, '
                     .'soit PayDunya n\'arrive pas à joindre notre URL de rappel. Vérifier d\'abord que '
                     .$this->urlAtteignable().'.',
            default => $initiation['message'] ?? 'Réponse inattendue de PayDunya.',
        };
    }

    private function urlAtteignable(): string
    {
        return route('reversements.rappel').' répond depuis l\'extérieur';
    }
}
