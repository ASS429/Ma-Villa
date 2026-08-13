<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AvisController;
use App\Http\Controllers\Api\ConfigurationController;
use App\Http\Controllers\Api\DisponibiliteController;
use App\Http\Controllers\Api\FavoriController;
use App\Http\Controllers\Api\LogementController;
use App\Http\Controllers\Api\PaiementController;
use App\Http\Controllers\Api\PhotoController;
use App\Http\Controllers\Api\ReservationController;
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
Route::get('/villas', [VillaController::class, 'index']);
Route::get('/destinations', [VillaController::class, 'destinations']);
Route::get('/villas/{villa}', [VillaController::class, 'show']);
Route::get('/villas/{villa}/occupation', [VillaController::class, 'occupation']);
Route::get('/villas/{villa}/logements', [LogementController::class, 'index']);
Route::get('/villas/{villa}/logements/{logement}', [LogementController::class, 'show']);
Route::get('/logements/{logement}/tarifs', [TarifController::class, 'index']);
Route::get('/logements/{logement}/disponibilites', [DisponibiliteController::class, 'index']);

// Protégées
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::patch('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/email/resend', [AuthController::class, 'resendVerification']);

    // Villas du propriétaire connecté
    Route::get('/proprietaire/villas', [VillaController::class, 'mesVillas']);

    // Villas (propriétaire)
    Route::post('/villas', [VillaController::class, 'store']);
    Route::put('/villas/{villa}', [VillaController::class, 'update']);
    Route::delete('/villas/{villa}', [VillaController::class, 'destroy']);

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
    Route::post('/reservations', [ReservationController::class, 'store']);
    Route::get('/reservations/{reservation}', [ReservationController::class, 'show']);
    Route::patch('/reservations/{reservation}/statut', [ReservationController::class, 'updateStatut']);

    // Upload fichier (retourne URL)
    Route::post('/upload', [PhotoController::class, 'upload']);

    // Photos
    Route::post('/villas/{villa}/photos', [PhotoController::class, 'storeForVilla']);
    Route::post('/villas/{villa}/logements/{logement}/photos', [PhotoController::class, 'storeForLogement']);
    Route::delete('/villas/{villa}/photos/{photo}', [PhotoController::class, 'destroy']);

    // Avis
    Route::post('/avis', [AvisController::class, 'store']);
    Route::get('/villas/{villa}/avis/eligibilite', [AvisController::class, 'eligibilite']);

    // Admin
    Route::middleware('admin')->prefix('admin')->group(function () {
        Route::get('/stats', [AdminController::class, 'stats']);
        Route::get('/villas', [AdminController::class, 'villas']);
        Route::patch('/villas/{villa}/statut', [AdminController::class, 'validerVilla']);
        Route::patch('/villas/{villa}/vedette', [AdminController::class, 'toggleVedette']);
        Route::get('/utilisateurs', [AdminController::class, 'utilisateurs']);
        Route::delete('/utilisateurs/{user}', [AdminController::class, 'supprimerUtilisateur']);
        Route::get('/avis', [AdminController::class, 'avis']);
        Route::delete('/avis/{avi}', [AdminController::class, 'supprimerAvis']);
    });

    // Favoris
    Route::get('/favoris', [FavoriController::class, 'index']);
    Route::post('/villas/{villa}/favoris', [FavoriController::class, 'store']);
    Route::delete('/villas/{villa}/favoris', [FavoriController::class, 'destroy']);
});
