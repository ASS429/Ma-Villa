<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Avis;
use App\Models\Reservation;
use App\Models\Villa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AvisController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'villa_id'    => 'required|exists:villas,id',
            'note'        => 'required|integer|between:1,5',
            'commentaire' => 'nullable|string|max:1000',
        ]);

        $user = $request->user();

        if ($user->role !== 'client') {
            return response()->json([
                'message' => 'Seuls les clients peuvent laisser un avis.',
            ], 403);
        }

        // La note moyenne est le principal signal de confiance de la
        // plateforme : elle ne doit venir que de séjours réellement effectués.
        if (! $this->aSejourne($user->id, $data['villa_id'])) {
            return response()->json([
                'message' => 'Vous ne pouvez laisser un avis qu\'après un séjour confirmé et terminé dans cette villa.',
            ], 403);
        }

        $avis = Avis::updateOrCreate(
            ['user_id' => $user->id, 'villa_id' => $data['villa_id']],
            ['note' => $data['note'], 'commentaire' => $data['commentaire'] ?? null]
        );

        return response()->json($avis->load('client'), 201);
    }

    /**
     * Indique si l'utilisateur peut déposer un avis sur cette villa,
     * pour que l'interface n'affiche le formulaire qu'à bon escient.
     */
    public function eligibilite(Request $request, Villa $villa): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'peut_noter' => $user->role === 'client' && $this->aSejourne($user->id, $villa->id),
            'avis_existant' => Avis::where('user_id', $user->id)
                ->where('villa_id', $villa->id)
                ->first(),
        ]);
    }

    private function aSejourne(int $userId, int $villaId): bool
    {
        return Reservation::where('user_id', $userId)
            ->where('statut', 'confirmee')
            ->where('date_fin', '<', now()->toDateString())
            ->whereHas('logement', fn ($q) => $q->where('villa_id', $villaId))
            ->exists();
    }
}
