<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AttendanceIndexRequest;
use App\Services\AdminAttendance;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;

class AttendanceController extends Controller
{
    public function __construct(private AdminAttendance $attendance) {}

    public function index(AttendanceIndexRequest $request): JsonResponse
    {
        $now = Date::now();

        return response()->json(['data' => $this->attendance->month(
            $request->month() ?? $now->format('Y-m'),
            $request->airportId(),
            $request->search(),
            $now,
        )]);
    }

    public function daily(AttendanceIndexRequest $request): JsonResponse
    {
        $now = Date::now();

        return response()->json(['data' => $this->attendance->daily(
            $request->day() ?? $now->toDateString(),
            $request->airportId(),
            $request->search(),
            $now,
        )]);
    }
}
