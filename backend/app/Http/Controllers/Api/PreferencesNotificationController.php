<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PreferencesNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * La grille des notifications — trois canaux, cinq sujets.
 *
 * Le barème complet est rendu par le serveur, libellés et verrous compris :
 * l'écran ne le connaît pas, il l'affiche. Ajouter un sujet ne demande donc pas
 * de redéployer l'interface.
 */
class PreferencesNotificationController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(PreferencesNotification::pour($request->user()));
    }

    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'preferences'     => 'required|array',
            'preferences.*'   => 'array',
            'preferences.*.*' => 'boolean',
        ]);

        $utilisateur = $request->user();

        // Assaini avant d'être écrit : les sujets et canaux inconnus tombent, et
        // les verrous ne sont jamais enregistrés — ils sont réappliqués à la
        // lecture, ce qui les rend impossibles à contourner en écrivant en base.
        $utilisateur->preferences_notification =
            PreferencesNotification::assainir($request->input('preferences'));

        $utilisateur->save();

        return response()->json(PreferencesNotification::pour($utilisateur));
    }
}
