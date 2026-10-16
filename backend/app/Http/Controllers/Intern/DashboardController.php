<?php

namespace App\Http\Controllers\Intern;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\InternDashboard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;

/**
 * Dashboard Intern: status hari ini, rekap bulan ini, Task aktif, periode magang, pengumuman.
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request, InternDashboard $dashboard): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        return response()->json(['data' => $dashboard->for($intern, Date::now())]);
    }
}
