<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reversement;
use App\Services\Deboursement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Rappel PayDunya après un déboursement.
 *
 * Cette URL est **publique** — PayDunya doit pouvoir l'atteindre, et refuse
 * même l'initiation si elle ne répond pas. Deux gardes en découlent, et il
 * faut les deux :
 *
 *   1. le `hash` transmis, SHA-512 de notre clé maîtresse, prouve l'origine ;
 *   2. le corps du rappel n'est **jamais** cru sur parole. Le statut est
 *      relu chez PayDunya avec notre jeton et nos clés.
 *
 * La leçon vient de l'encaissement, où l'IPN n'a jamais fait foi. Elle vaut
 * doublement ici : un « versement réussi » accepté sans vérification solderait
 * une dette dont pas un franc n'est parti.
 */
class RappelDeboursementController extends Controller
{
    public function __construct(
        private readonly Deboursement $deboursement,
        private readonly ReversementController $reversements,
    ) {
    }

    public function __invoke(Request $request): JsonResponse
    {
        if (! $this->deboursement->rappelAuthentique($request->input('hash'))) {
            Log::warning('Rappel de déboursement rejeté : signature invalide', [
                'ip' => $request->ip(),
            ]);

            // 200 volontairement : renvoyer une erreur inviterait PayDunya à
            // réessayer une notification qui n'est pas la sienne, et signalerait
            // à un curieux que l'URL existe et attend une signature valable.
            return response()->json(['message' => 'ignoré']);
        }

        $jeton = (string) $request->input('token');
        $reversement = Reversement::where('disburse_token', $jeton)->first();

        if (! $jeton || ! $reversement) {
            Log::warning('Rappel de déboursement sans reversement connu', ['jeton' => $jeton]);

            return response()->json(['message' => 'inconnu']);
        }

        // Le statut vient de l'API, pas du corps reçu.
        $verifie = $this->deboursement->statut($jeton);

        $this->reversements->inscrireLeStatut(
            $reversement,
            $verifie['statut'],
            $verifie['brut']['response_text'] ?? null,
            $verifie['brut'],
        );

        return response()->json(['message' => 'reçu']);
    }
}
