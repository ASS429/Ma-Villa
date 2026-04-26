<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Avis;
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

        $avis = Avis::updateOrCreate(
            ['user_id' => $request->user()->id, 'villa_id' => $data['villa_id']],
            ['note' => $data['note'], 'commentaire' => $data['commentaire'] ?? null]
        );

        return response()->json($avis->load('client'), 201);
    }
}
