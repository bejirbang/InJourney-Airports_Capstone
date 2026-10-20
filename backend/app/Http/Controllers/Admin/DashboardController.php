<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminDashboard;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;

/**
 * Dashboard Admin: kartu hari ini, ringkasan kemarin, dan kotak Perlu Tindakan.
 */
class DashboardController extends Controller
{
    public function __invoke(AdminDashboard $dashboard): JsonResponse
    {
        return response()->json(['data' => $dashboard->for(Date::now())]);
    }
}
