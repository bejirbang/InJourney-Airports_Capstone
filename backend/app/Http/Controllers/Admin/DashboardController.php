<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminDashboard;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;

class DashboardController extends Controller
{
    public function __invoke(AdminDashboard $dashboard): JsonResponse
    {
        return response()->json(['data' => $dashboard->for(Date::now())]);
    }
}
