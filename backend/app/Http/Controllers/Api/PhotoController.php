<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Logement;
use App\Models\Villa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PhotoController extends Controller
{
    public function storeForVilla(Request $request, Villa $villa): JsonResponse
    {
        $this->authorize('update', $villa);

        $request->validate([
            'photos'          => 'required|array|min:1',
            'photos.*.url'    => 'required|string',
            'photos.*.alt'    => 'nullable|string',
            'photos.*.ordre'  => 'integer',
        ]);

        $photos = collect($request->photos)->map(fn($p, $i) => [
            'url'   => $p['url'],
            'alt'   => $p['alt'] ?? null,
            'ordre' => $p['ordre'] ?? $i,
        ]);

        $created = $villa->photos()->createMany($photos->toArray());

        return response()->json($created, 201);
    }

    public function storeForLogement(Request $request, Villa $villa, Logement $logement): JsonResponse
    {
        $this->authorize('update', $villa);

        $request->validate([
            'photos'          => 'required|array|min:1',
            'photos.*.url'    => 'required|string',
            'photos.*.alt'    => 'nullable|string',
            'photos.*.ordre'  => 'integer',
        ]);

        $photos = collect($request->photos)->map(fn($p, $i) => [
            'url'   => $p['url'],
            'alt'   => $p['alt'] ?? null,
            'ordre' => $p['ordre'] ?? $i,
        ]);

        $created = $logement->photos()->createMany($photos->toArray());

        return response()->json($created, 201);
    }

    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:jpeg,jpg,png,webp,gif,mp4,mov,webm|max:102400',
        ]);

        $path = $request->file('file')->store('uploads', 'public');
        $url = url(Storage::url($path));

        return response()->json(['url' => $url]);
    }

    public function destroy(Villa $villa, int $photo): JsonResponse
    {
        $this->authorize('update', $villa);
        $villa->photos()->findOrFail($photo)->delete();

        return response()->json(['message' => 'Photo supprimée.']);
    }
}
