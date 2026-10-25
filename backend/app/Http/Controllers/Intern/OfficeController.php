<?php

namespace App\Http\Controllers\Intern;

use App\Http\Controllers\Controller;
use App\Http\Resources\OfficeResource;
use App\Models\Office;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OfficeController extends Controller
{
    /**
     * Hanya titik presensi aktif milik bandara lokasi magang intern.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        return response()->json([
            'data' => OfficeResource::collection(Office::query()
                ->active()
                ->where('airport_id', $intern->internProfile?->airport_id)
                ->orderBy('name')
                ->get()),
        ]);
    }
}
