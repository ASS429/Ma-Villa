<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Favori;
use App\Models\Villa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FavoriController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // Mêmes règles que le catalogue : une annonce retirée ou en brouillon
        // ne s'y lit pas, et le numéro de la villa n'est pas public.
        $favoris = $request->user()->favoris()
            ->whereHas('villa', fn ($q) => $q->where('statut', 'validee'))
            ->with(['villa' => fn ($q) => $q->withoutTelephone(), 'villa.photos', 'villa.avis'])
            ->get();

        return response()->json($favoris);
    }

    public function store(Request $request, Villa $villa): JsonResponse
    {
        abort_if($villa->statut !== 'validee', 404);

        $favori = Favori::firstOrCreate([
            'user_id'  => $request->user()->id,
            'villa_id' => $villa->id,
        ]);

        return response()->json($favori, 201);
    }

    public function destroy(Request $request, Villa $villa): JsonResponse
    {
        $request->user()->favoris()->where('villa_id', $villa->id)->delete();

        return response()->json(['message' => 'Retiré des favoris.']);
    }
}
