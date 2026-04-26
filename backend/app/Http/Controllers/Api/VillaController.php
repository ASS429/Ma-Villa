<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VillaRequest;
use App\Models\Villa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VillaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Villa::with(['photos', 'avis'])
            ->where('statut', 'validee');

        if ($request->ville) {
            $query->where('ville', 'like', "%{$request->ville}%");
        }

        if ($request->prix_min || $request->prix_max) {
            $query->whereHas('logements.tarifs', function ($q) use ($request) {
                if ($request->prix_min) $q->where('prix', '>=', $request->prix_min);
                if ($request->prix_max) $q->where('prix', '<=', $request->prix_max);
            });
        }

        if ($request->type_logement) {
            $query->whereHas('logements', fn($q) => $q->where('type', $request->type_logement));
        }

        if ($request->boolean('vedette')) {
            $query->where('vedette', true);
        }

        $villas = $query->paginate(12);

        return response()->json($villas);
    }

    public function mesVillas(Request $request): JsonResponse
    {
        $villas = $request->user()->villas()->with('photos')->latest()->get();

        return response()->json($villas);
    }

    public function store(VillaRequest $request): JsonResponse
    {
        $villa = $request->user()->villas()->create($request->validated());

        return response()->json($villa, 201);
    }

    public function show(Villa $villa): JsonResponse
    {
        $villa->load(['logements.tarifs', 'photos', 'avis.client', 'proprietaire']);

        return response()->json($villa);
    }

    public function update(VillaRequest $request, Villa $villa): JsonResponse
    {
        $this->authorize('update', $villa);
        $villa->update($request->validated());

        return response()->json($villa);
    }

    public function destroy(Villa $villa): JsonResponse
    {
        $this->authorize('delete', $villa);
        $villa->delete();

        return response()->json(['message' => 'Villa supprimée.']);
    }
}
