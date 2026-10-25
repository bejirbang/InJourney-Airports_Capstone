<?php

namespace App\Http\Controllers\Mentor;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\MentorDashboard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;

class DashboardController extends Controller
{
    public function __invoke(Request $request, MentorDashboard $dashboard): JsonResponse
    {
        /** @var User $mentor */
        $mentor = $request->user();

        return response()->json(['data' => $dashboard->for($mentor, Date::now())]);
    }
}
