<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminDashboard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;

class DashboardController extends Controller
{
    public function __invoke(Request $request, AdminDashboard $dashboard): JsonResponse
    {
        $airportId = $request->filled('airport_id') ? $request->integer('airport_id') : null;

        return response()->json(['data' => $dashboard->for(Date::now(), $airportId)]);
    }
}
