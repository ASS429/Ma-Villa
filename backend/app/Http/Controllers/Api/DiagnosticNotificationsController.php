<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AbonnementPush;
use App\Services\Push;
use Illuminate\Http\JsonResponse;
use Minishlink\WebPush\ContentEncoding;
use Minishlink\WebPush\VAPID;

/**
 * Sonde la chaîne des notifications poussées.
 *
 * `/api/configuration` annonce `notifications.actives` dès que les trois
 * variables VAPID existent. C'est ce qu'il faut pour décider d'afficher un
 * bouton — mais cela ne prouve rien sur la crypto.
 *
 * Or une clé tronquée, un espace recopié en trop, une paire dépareillée : tout
 * cela passe le contrôle de `/api/configuration` et fait **échouer le premier
 * envoi en silence** — `Push` attrape l'erreur et la journalise, parce qu'une
 * notification ratée ne doit jamais interrompre une réservation. Le résultat
 * est une fonctionnalité qui paraît active et ne délivre rien.
 *
 * Cette sonde signe donc réellement un jeton. C'est la seule chose qui
 * distingue « configuré » de « fonctionne ».
 *
 * ⚠️ `gmp` n'est **pas** requise pour signer — vérifié le 19 août 2026, un
 * jeton valide est produit sans elle. Elle ne sert qu'à *générer* une paire
 * (`php artisan push:cles`), opération faite une fois pour toutes. Son état
 * est rapporté ici pour cette raison-là, pas parce qu'un envoi en dépendrait.
 *
 * Réservée aux administrateurs : elle nomme les extensions chargées et
 * l'empreinte des clés.
 */
class DiagnosticNotificationsController extends Controller
{
    public function __construct(private readonly Push $push)
    {
    }

    public function __invoke(): JsonResponse
    {
        $etat = [
            'actif_declare' => (bool) config('push.actif'),
            'extensions' => [
                // Utile seulement pour `push:cles` : sans elle la génération
                // d'une paire échoue sur « Unable to create the key », qui ne
                // nomme pas l'extension. L'envoi, lui, n'en a pas besoin.
                'gmp' => extension_loaded('gmp'),
                'openssl' => extension_loaded('openssl'),
                'bcmath' => extension_loaded('bcmath'),
                'curl' => extension_loaded('curl'),
                'mbstring' => extension_loaded('mbstring'),
            ],
            'cles' => $this->empreintesDesCles(),
            'abonnements' => AbonnementPush::count(),
        ];

        if (! $this->push->disponible()) {
            return response()->json($etat + [
                'signature' => [
                    'ok' => false,
                    'erreur' => 'Clés VAPID absentes ou fonction désactivée : rien à signer.',
                ],
                'verdict' => 'Notifications inactives.',
            ]);
        }

        // La vraie épreuve, en deux temps.
        //
        // `validate()` décode les clés base64url et vérifie leurs longueurs
        // (65 et 32 octets) : il attrape une clé tronquée ou mal recopiée,
        // sans toucher à la crypto.
        //
        // `getVapidHeaders()` signe ensuite un jeton ES256 sur la courbe
        // P-256 — c'est cette étape-là qui exige `gmp`. Elle attend des
        // octets bruts, pas du base64url : lui passer la valeur de
        // configuration telle quelle échouerait sur « only uncompressed keys
        // are supported », un faux négatif qui ferait chercher au mauvais
        // endroit.
        //
        // Aucune requête sortante, aucun abonné touché.
        try {
            $cles = VAPID::validate([
                'subject' => (string) config('push.vapid.sujet'),
                'publicKey' => (string) config('push.vapid.publique'),
                'privateKey' => (string) config('push.vapid.privee'),
            ]);

            $entetes = VAPID::getVapidHeaders(
                audience: 'https://fcm.googleapis.com',
                subject: (string) config('push.vapid.sujet'),
                publicKey: $cles['publicKey'],
                privateKey: $cles['privateKey'],
                contentEncoding: ContentEncoding::aes128gcm,
            );

            $signe = isset($entetes['Authorization']) && $entetes['Authorization'] !== '';

            return response()->json($etat + [
                'signature' => [
                    'ok' => $signe,
                    'entetes' => array_keys($entetes),
                ],
                'verdict' => $signe
                    ? 'Notifications opérationnelles : la signature VAPID aboutit.'
                    : 'Signature vide — envoi impossible.',
            ]);
        } catch (\Throwable $e) {
            return response()->json($etat + [
                'signature' => [
                    'ok' => false,
                    'erreur' => $e->getMessage(),
                ],
                // La cause est presque toujours les clés elles-mêmes :
                // tronquées, dépareillées, ou porteuses d'un espace recopié.
                // L'empreinte ci-dessus (longueur, début, espaces en bout)
                // suffit à trancher sans jamais divulguer la privée.
                'verdict' => 'Signature refusée : vérifier les trois variables VAPID. '
                    .'Longueurs attendues, une fois décodées : 65 octets pour la publique, '
                    .'32 pour la privée. Les deux doivent venir de la même génération.',
            ]);
        }
    }

    /**
     * Assez pour reconnaître une clé, jamais assez pour s'en servir. Un espace
     * en bout, invisible dans un tableau de bord, suffit à faire échouer la
     * signature — d'où la longueur et le drapeau d'espaces.
     *
     * @return array<string, mixed>
     */
    private function empreintesDesCles(): array
    {
        $empreinte = function (string $valeur): array {
            return [
                'presente' => $valeur !== '',
                'longueur' => strlen($valeur),
                'debut' => $valeur === '' ? null : substr($valeur, 0, 6),
                'espaces_en_bout' => $valeur !== trim($valeur),
            ];
        };

        return [
            'sujet' => (string) config('push.vapid.sujet'),
            'publique' => $empreinte((string) config('push.vapid.publique')),
            // La privée n'est jamais montrée, même en partie.
            'privee' => ['presente' => ((string) config('push.vapid.privee')) !== ''],
        ];
    }
}
