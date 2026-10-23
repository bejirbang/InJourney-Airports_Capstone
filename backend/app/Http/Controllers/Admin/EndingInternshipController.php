<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\EndingInternships;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;

/**
 * Lihat semua "Magang berakhir dalam 7 hari" (docs/design-admin.md 5.2, Alur 6). Dashboard hanya menampilkan 5 baris.
 */
class EndingInternshipController extends Controller
{
    public function __invoke(EndingInternships $endings): JsonResponse
    {
        return response()->json(['data' => $endings->all(Date::now())]);
    }
}
