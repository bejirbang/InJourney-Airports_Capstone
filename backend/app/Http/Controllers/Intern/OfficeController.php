<?php

namespace App\Http\Controllers\Intern;

use App\Http\Controllers\Controller;
use App\Http\Resources\OfficeResource;
use App\Models\Office;
use Illuminate\Http\JsonResponse;

/**
 * Daftar kantor aktif untuk fitur absensi intern: dropdown kantor dan peta radius.
 * Pemeriksaan jarak tetap di server; frontend hanya menampilkan perkiraan.
 */
class OfficeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => OfficeResource::collection(Office::query()->active()->orderBy('name')->get()),
        ]);
    }
}
