<?php

namespace App\Http\Controllers\Intern;

use App\Http\Controllers\Controller;
use App\Http\Requests\Intern\ClockOutRequest;
use App\Http\Requests\Intern\ClockRequest;
use App\Http\Requests\Shared\AttendanceHistoryRequest;
use App\Http\Resources\AttendanceResource;
use App\Models\User;
use App\Services\AttendanceClock;
use App\Services\AttendanceHistory;
use App\Support\Duration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Symfony\Component\HttpFoundation\Response;

class AttendanceController extends Controller
{
    public function clockIn(ClockRequest $request, AttendanceClock $clock): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        $attendance = $clock->clockIn(
            $intern,
            $request->float('latitude'),
            $request->float('longitude'),
            Date::now(),
        )->load('clockInOffice');

        $message = 'Clock in berhasil pukul '.substr((string) $attendance->clock_in_at, 0, 5).'.';
        $lateMinutes = $attendance->lateMinutes();

        if ($lateMinutes !== null) {
            $message .= ' Anda tercatat Terlambat '.Duration::minutes($lateMinutes).'.';
        }

        return response()->json([
            'message' => $message,
            'data' => new AttendanceResource($attendance),
        ], Response::HTTP_CREATED);
    }

    public function clockOut(ClockOutRequest $request, AttendanceClock $clock): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        $attendance = $clock->clockOut(
            $intern,
            $request->float('latitude'),
            $request->float('longitude'),
            $request->filled('work') ? $request->string('work')->value() : null,
            $request->filled('notes') ? $request->string('notes')->value() : null,
            Date::now(),
        )->load(['clockInOffice', 'clockOutOffice', 'logbook']);

        return response()->json([
            'message' => 'Clock out berhasil pukul '.substr((string) $attendance->clock_out_at, 0, 5).'. Logbook terkirim ke mentor.',
            'data' => new AttendanceResource($attendance),
        ]);
    }

    public function history(AttendanceHistoryRequest $request, AttendanceHistory $history): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        return response()->json(['data' => $history->month($intern, $request->month(), $request->statusFilter(), Date::now())]);
    }

    public function day(Request $request, string $date, AttendanceHistory $history): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        return response()->json(['data' => $history->day($intern, $date, Date::now())]);
    }
}
