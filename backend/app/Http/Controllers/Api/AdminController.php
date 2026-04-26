<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function stats(): JsonResponse
    {
        return response()->json([
            'utilisateurs'  => User::count(),
            'villas_total'  => Villa::count(),
            'villas_attente'=> Villa::where('statut', 'en_attente')->count(),
            'reservations'  => Reservation::count(),
            'revenus'       => Reservation::where('statut', 'confirmee')->sum('montant_total'),
        ]);
    }

    public function villas(Request $request): JsonResponse
    {
        $statut = $request->statut ?? 'en_attente';
        $villas = Villa::with('proprietaire')
            ->where('statut', $statut)
            ->latest()
            ->get();

        return response()->json($villas);
    }

    public function validerVilla(Request $request, Villa $villa): JsonResponse
    {
        $request->validate(['statut' => 'required|in:validee,rejetee']);
        $villa->update(['statut' => $request->statut]);

        return response()->json($villa);
    }

    public function utilisateurs(): JsonResponse
    {
        return response()->json(User::latest()->get());
    }

    public function supprimerUtilisateur(User $user): JsonResponse
    {
        $user->delete();

        return response()->json(['message' => 'Utilisateur supprimé.']);
    }

    public function avis(): JsonResponse
    {
        $avis = \App\Models\Avis::with(['client', 'villa'])->latest()->get();

        return response()->json($avis);
    }

    public function supprimerAvis(\App\Models\Avis $avi): JsonResponse
    {
        $avi->delete();

        return response()->json(['message' => 'Avis supprimé.']);
    }

    public function toggleVedette(Villa $villa): JsonResponse
    {
        $villa->update(['vedette' => !$villa->vedette]);

        return response()->json($villa);
    }
}
