<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AttentesController;
use App\Http\Controllers\Api\AvisController;
use App\Http\Controllers\Api\ConfigurationController;
use App\Http\Controllers\Api\DiagnosticNotificationsController;
use App\Http\Controllers\Api\DiagnosticReversementController;
use App\Http\Controllers\Api\DiagnosticPaiementController;
use App\Http\Controllers\Api\DisponibiliteController;
use App\Http\Controllers\Api\FavoriController;
use App\Http\Controllers\Api\LogementController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\NotificationPushController;
use App\Http\Controllers\Api\PaiementController;
use App\Http\Controllers\Api\PhotoController;
use App\Http\Controllers\Api\CommandeController;
use App\Http\Controllers\Api\OeuvreController;
use App\Http\Controllers\Api\PreferencesNotificationController;
use App\Http\Controllers\Api\ReservationController;
use App\Http\Controllers\Api\RappelDeboursementController;
use App\Http\Controllers\Api\ReversementController;
use App\Http\Controllers\Api\TarifController;
use App\Http\Controllers\Api\VillaController;
use Illuminate\Support\Facades\Route;

// Auth
Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:6,1');
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:6,1');
Route::get('/auth/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
    ->middleware('signed')
    ->name('verification.verify');

// Public
Route::get('/configuration', ConfigurationController::class);

// Notification de paiement PayDunya. Publique par nature — le prestataire
// n'a pas de session — mais authentifiée par le hash de la clé maîtresse.
Route::post('/paiements/ipn', [PaiementController::class, 'ipn'])->name('paiements.ipn');

// Rappel de deboursement, le symetrique cote sortant. PayDunya refuse
// l'initiation si cette URL ne repond pas : elle doit rester publique,
// et sa seule garde est la signature de la cle maitresse.
Route::post('/reversements/rappel', RappelDeboursementController::class)
    ->name('reversements.rappel');
// Boutique d'oeuvres d'art. PasseTemps est le seul vendeur : pas de role
// artiste, pas de moderation. Les routes repondent 404 tant que
// BOUTIQUE_ACTIVE n'est pas levee -- un metier s'ouvre par decision.
Route::get('/oeuvres', [OeuvreController::class, 'index']);
Route::get('/oeuvres/artistes', [OeuvreController::class, 'artistes']);
Route::get('/oeuvres/categories', [OeuvreController::class, 'categories']);
Route::get('/oeuvres/{oeuvre}', [OeuvreController::class, 'show']);

Route::get('/villas', [VillaController::class, 'index']);
Route::get('/destinations', [VillaController::class, 'destinations']);
Route::get('/villas/{villa}', [VillaController::class, 'show']);
Route::get('/villas/{villa}/occupation', [VillaController::class, 'occupation']);
Route::get('/villas/{villa}/logements', [LogementController::class, 'index']);
Route::get('/villas/{villa}/logements/{logement}', [LogementController::class, 'show']);
Route::get('/logements/{logement}/tarifs', [TarifController::class, 'index']);
Route::get('/logements/{logement}/disponibilites', [DisponibiliteController::class, 'index']);

// Protégées
//
// Les routes qui écrivent portent une limite de débit. L'authentification
// seule ne suffit pas : un compte légitime peut créer des milliers de
// réservations ou saturer le stockage objet, facturé au volume. Les plafonds
// sont larges — ils arrêtent une boucle, pas un usage soutenu.
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::patch('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/email/resend', [AuthController::class, 'resendVerification']);

    // Villas du propriétaire connecté
    Route::get('/proprietaire/villas', [VillaController::class, 'mesVillas']);

    // Villas (propriétaire)
    Route::post('/villas', [VillaController::class, 'store'])->middleware('throttle:10,1');
    Route::put('/villas/{villa}', [VillaController::class, 'update']);
    Route::delete('/villas/{villa}', [VillaController::class, 'destroy']);

    // Soumettre un brouillon. C'est ici que la complétude se vérifie — la
    // création, elle, ne demande qu'un nom et une ville.
    Route::post('/villas/{villa}/publier', [VillaController::class, 'publier']);

    // Ce que le propriétaire gagnera, et ce qui se pratique dans sa ville.
    // À l'étape du prix, où il hésite le plus.
    Route::get('/reperes-de-prix', [VillaController::class, 'reperesDePrix']);

    // Logements
    Route::post('/villas/{villa}/logements', [LogementController::class, 'store']);
    Route::put('/villas/{villa}/logements/{logement}', [LogementController::class, 'update']);
    Route::patch('/villas/{villa}/logements/{logement}/disponibilite', [LogementController::class, 'toggleDisponibilite']);
    Route::delete('/villas/{villa}/logements/{logement}', [LogementController::class, 'destroy']);

    // Tarifs
    Route::post('/logements/{logement}/tarifs', [TarifController::class, 'store']);
    Route::put('/logements/{logement}/tarifs/{tarif}', [TarifController::class, 'update']);
    Route::delete('/logements/{logement}/tarifs/{tarif}', [TarifController::class, 'destroy']);

    // Disponibilités
    Route::post('/logements/{logement}/disponibilites', [DisponibiliteController::class, 'store']);
    Route::delete('/logements/{logement}/disponibilites/{disponibilite}', [DisponibiliteController::class, 'destroy']);

    // Paiement
    Route::post('/reservations/{reservation}/paiement', [PaiementController::class, 'initier']);
    Route::get('/reservations/{reservation}/paiement', [PaiementController::class, 'statut']);

    // Réservations
    Route::get('/reservations', [ReservationController::class, 'index']);
    Route::post('/reservations', [ReservationController::class, 'store'])->middleware('throttle:10,1');
    Route::get('/reservations/{reservation}', [ReservationController::class, 'show']);
    Route::patch('/reservations/{reservation}/statut', [ReservationController::class, 'updateStatut']);

    // Messagerie — la réservation tient lieu de conversation, et sa politique
    // d'accès sert d'autorisation : client, propriétaire du logement, admin.
    Route::get('/messages/non-lus', [MessageController::class, 'nonLus']);
    Route::get('/reservations/{reservation}/messages', [MessageController::class, 'index']);
    Route::post('/reservations/{reservation}/messages', [MessageController::class, 'store'])
        ->middleware('throttle:30,1');

    // Revenus du propriétaire : ce qui lui est dû, ce qui lui a été versé.
    // La part était calculée et stockée depuis le premier encaissement, mais
    // n'apparaissait sur aucun écran.
    Route::get('/proprietaire/revenus', [ReversementController::class, 'revenus']);

    // Commandes d'oeuvres. Une oeuvre par commande : une piece est unique.
    Route::get('/commandes', [CommandeController::class, 'index']);
    Route::post('/commandes', [CommandeController::class, 'store'])->middleware('throttle:10,1');
    Route::get('/commandes/{commande}', [CommandeController::class, 'show']);
    Route::patch('/commandes/{commande}/annuler', [CommandeController::class, 'annuler']);
    Route::post('/commandes/{commande}/paiement', [CommandeController::class, 'payer'])
        ->middleware('throttle:10,1');
    Route::get('/commandes/{commande}/paiement/statut', [CommandeController::class, 'statut']);

    // Preferences de notification : trois canaux, cinq sujets. Le bareme
    // complet est rendu par le serveur, verrous compris.
    Route::get('/notifications/preferences', [PreferencesNotificationController::class, 'show']);
    Route::put('/notifications/preferences', [PreferencesNotificationController::class, 'update']);

    // Upload fichier (retourne URL)
    Route::post('/upload', [PhotoController::class, 'upload'])->middleware('throttle:40,1');

    // Photos
    Route::post('/villas/{villa}/photos', [PhotoController::class, 'storeForVilla']);
    Route::post('/villas/{villa}/logements/{logement}/photos', [PhotoController::class, 'storeForLogement']);
    Route::delete('/villas/{villa}/photos/{photo}', [PhotoController::class, 'destroy']);

    // Avis
    Route::post('/avis', [AvisController::class, 'store'])->middleware('throttle:5,1');
    Route::get('/villas/{villa}/avis/eligibilite', [AvisController::class, 'eligibilite']);

    // Admin
    Route::middleware('admin')->prefix('admin')->group(function () {
        // Ce qui attend une décision. Première entrée du châssis : sans elle,
        // savoir s'il y a du travail coûte l'ouverture de neuf pages.
        Route::get('/attentes', AttentesController::class);

        Route::get('/stats', [AdminController::class, 'stats']);
        // Séries de trente jours et fil d'activité : ce que les chiffres
        // de tête ne disent pas — la tendance et ce qui vient d'arriver.
        Route::get('/statistiques', [AdminController::class, 'statistiques']);
        Route::get('/activite', [AdminController::class, 'activite']);
        Route::get('/villas', [AdminController::class, 'villas']);
        Route::patch('/villas/{villa}/statut', [AdminController::class, 'validerVilla']);
        Route::patch('/villas/{villa}/vedette', [AdminController::class, 'toggleVedette']);
        Route::get('/utilisateurs', [AdminController::class, 'utilisateurs']);
        Route::delete('/utilisateurs/{user}', [AdminController::class, 'supprimerUtilisateur']);
        Route::get('/avis', [AdminController::class, 'avis']);
        Route::delete('/avis/{avi}', [AdminController::class, 'supprimerAvis']);

        // Journal d'audit : qui a validé, rejeté, supprimé — et quand. En cas
        // de litige avec un propriétaire, c'est la seule chose à produire.
        Route::get('/journal', [AdminController::class, 'journal']);

        // Reversements. L'enregistrement seulement : le virement lui-même
        // reste un geste humain, le décaissement automatique demandant une
        // activation PayDunya qui n'est pas acquise.
        // Boutique : gestion du stock et suivi des commandes.
        Route::get('/oeuvres', [OeuvreController::class, 'indexAdmin']);
        Route::post('/oeuvres', [OeuvreController::class, 'store']);
        Route::patch('/oeuvres/{oeuvre}', [OeuvreController::class, 'update']);
        Route::delete('/oeuvres/{oeuvre}', [OeuvreController::class, 'destroy']);
        Route::post('/oeuvres/{oeuvre}/photos', [PhotoController::class, 'storeForOeuvre']);
        Route::delete('/oeuvres/{oeuvre}/photos/{photo}', [PhotoController::class, 'destroyForOeuvre']);
        Route::get('/commandes', [CommandeController::class, 'indexAdmin']);
        Route::patch('/commandes/{commande}/statut', [CommandeController::class, 'avancer']);

        Route::get('/reversements', [ReversementController::class, 'index']);
        Route::post('/reversements', [ReversementController::class, 'store'])
            ->middleware('throttle:20,1');

        // Sonde PayDunya : dit ce que le prestataire répond, sans réservation
        // ni paiement. Le seul moyen de diagnostiquer une fois les clés de
        // production en place, la cause d'un refus n'étant plus montrée au payeur.
        Route::get('/diagnostic/paiement', DiagnosticPaiementController::class);

        // Sonde des notifications. `/api/configuration` dit seulement que les
        // clés existent ; celle-ci signe réellement un jeton, seule preuve que
        // l'extension gmp est là et que la crypto aboutit.
        Route::get('/diagnostic/notifications', DiagnosticNotificationsController::class);

        // Sonde du deboursement. Elle ne fait qu'initier : la documentation
        // PayDunya est formelle, un jeton cree reste « created » tant qu'il
        // n'est pas soumis. Aucun franc ne peut donc partir en la lancant.
        Route::get('/diagnostic/reversement', DiagnosticReversementController::class);
    });

    // Notifications poussées — l'abonnement appartient à un appareil, pas
    // seulement à un compte : le même utilisateur en a un par navigateur.
    Route::post('/notifications/abonnement', [NotificationPushController::class, 'store']);
    Route::delete('/notifications/abonnement', [NotificationPushController::class, 'destroy']);

    // Favoris
    Route::get('/favoris', [FavoriController::class, 'index']);
    Route::post('/villas/{villa}/favoris', [FavoriController::class, 'store']);
    Route::delete('/villas/{villa}/favoris', [FavoriController::class, 'destroy']);
});
