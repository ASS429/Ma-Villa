<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AbonnementPush;
use App\Services\Push;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class NotificationPushController extends Controller
{
    public const PLAFOND_PAR_COMPTE = 10;

    /**
     * Les services de notifications des navigateurs (Chrome, Firefox, Safari,
     * Edge). Le serveur envoie une requête à l'adresse enregistrée : acceptée
     * telle quelle, n'importe quelle adresse — interne comprise — lui était
     * désignée comme cible.
     */
    private const SERVICES_DE_POUSSEE = [
        'fcm.googleapis.com',
        'updates.push.services.mozilla.com',
        'web.push.apple.com',
        'notify.windows.com',
    ];

    public static function serviceDePoussee(string $endpoint): bool
    {
        $hote = strtolower((string) parse_url($endpoint, PHP_URL_HOST));

        foreach (self::SERVICES_DE_POUSSEE as $service) {
            if ($hote === $service || str_ends_with($hote, '.'.$service)) {
                return true;
            }
        }

        return false;
    }

    public function __construct(private readonly Push $push)
    {
    }

    /**
     * Enregistre l'appareil courant.
     *
     * L'endpoint identifie le navigateur : le même appareil qui réautorise
     * doit remplacer son abonnement, pas en créer un second — sinon
     * l'utilisateur reçoit chaque notification en double, et rien dans
     * l'interface ne lui explique pourquoi.
     */
    public function store(Request $request): JsonResponse
    {
        if (! $this->push->disponible()) {
            return response()->json([
                'message' => 'Les notifications ne sont pas configurées sur ce serveur.',
            ], 503);
        }

        $donnees = $request->validate([
            'endpoint' => ['required', 'string', 'max:500', 'url:https', function ($attribut, $valeur, $echec) {
                if (! self::serviceDePoussee((string) $valeur)) {
                    $echec("Cette adresse n'est pas celle d'un service de notifications.");
                }
            }],
            'cle_p256dh' => 'required|string|max:255',
            'cle_auth' => 'required|string|max:255',
            'expire_le' => 'nullable|date',
        ]);

        // Chaque abonnement est une requête que le serveur envoie à chaque
        // notification : sans plafond, un compte en enregistrait autant qu'il
        // voulait. Dix appareils couvrent tout usage réel.
        $dejaLa = AbonnementPush::where('endpoint', $donnees['endpoint'])->exists();
        if (! $dejaLa && AbonnementPush::where('user_id', $request->user()->id)->count() >= self::PLAFOND_PAR_COMPTE) {
            return response()->json([
                'message' => 'Trop d’appareils reçoivent déjà vos notifications. Coupez-les sur un ancien appareil.',
            ], 422);
        }

        $abonnement = AbonnementPush::updateOrCreate(
            ['endpoint' => $donnees['endpoint']],
            [
                'user_id' => $request->user()->id,
                'cle_p256dh' => $donnees['cle_p256dh'],
                'cle_auth' => $donnees['cle_auth'],
                'expire_le' => $donnees['expire_le'] ?? null,
                'appareil' => $this->nommerAppareil($request->userAgent()),
                // Un abonnement réenregistré repart d'une ardoise nette : les
                // échecs comptés venaient de l'inscription précédente.
                'echecs' => 0,
            ]
        );

        return response()->json([
            'message' => 'Notifications activées sur cet appareil.',
            'appareil' => $abonnement->appareil,
        ], 201);
    }

    /** Retire l'appareil courant. */
    public function destroy(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'endpoint' => 'required|string|max:500',
        ]);

        // Restreint au propriétaire de l'abonnement : sans cela, connaître un
        // endpoint suffirait à couper les notifications de quelqu'un d'autre.
        AbonnementPush::where('endpoint', $donnees['endpoint'])
            ->where('user_id', $request->user()->id)
            ->delete();

        return response()->json(['message' => 'Notifications désactivées sur cet appareil.']);
    }

    /**
     * Un libellé qu'on reconnaît d'un coup d'œil dans la liste de ses
     * appareils. L'agent utilisateur complet y serait illisible.
     */
    private function nommerAppareil(?string $agent): string
    {
        if (! $agent) {
            return 'Appareil inconnu';
        }

        $navigateur = match (true) {
            Str::contains($agent, 'Edg/') => 'Edge',
            Str::contains($agent, 'OPR/') => 'Opera',
            Str::contains($agent, 'Firefox') => 'Firefox',
            Str::contains($agent, 'Chrome') => 'Chrome',
            Str::contains($agent, 'Safari') => 'Safari',
            default => 'Navigateur',
        };

        $systeme = match (true) {
            Str::contains($agent, 'Android') => 'Android',
            Str::contains($agent, ['iPhone', 'iPad']) => 'iOS',
            Str::contains($agent, 'Windows') => 'Windows',
            Str::contains($agent, 'Mac OS') => 'macOS',
            Str::contains($agent, 'Linux') => 'Linux',
            default => null,
        };

        return $systeme ? "{$navigateur} sur {$systeme}" : $navigateur;
    }
}
