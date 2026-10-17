<?php

namespace App\Http\Controllers\Intern;

use App\Http\Controllers\Controller;
use App\Http\Requests\Intern\ClockRequest;
use App\Http\Requests\Intern\DailyReportRequest;
use App\Http\Requests\Shared\AttendanceHistoryRequest;
use App\Http\Resources\AttendanceResource;
use App\Http\Resources\DailyReportResource;
use App\Models\User;
use App\Models\WorkHourSetting;
use App\Services\AttendanceClock;
use App\Services\AttendanceHistory;
use App\Services\DailyReports;
use App\Support\Duration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Symfony\Component\HttpFoundation\Response;

/**
 * Absensi milik intern yang login.
 */
class AttendanceController extends Controller
{
    /**
     * Clock in tetap diterima walau lewat jam masuk; keterlambatan hanya ditandai.
     */
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

        $message = 'Clock in berhasil pukul '.substr($attendance->clock_in_at, 0, 5).'.';
        $lateMinutes = $attendance->lateMinutes(WorkHourSetting::effectiveOn($attendance->date->toDateString()));

        if ($lateMinutes > 0) {
            $message .= ' Anda terlambat '.Duration::minutes($lateMinutes).'.';
        }

        return response()->json([
            'message' => $message,
            'data' => new AttendanceResource($attendance),
        ], Response::HTTP_CREATED);
    }

    public function clockOut(ClockRequest $request, AttendanceClock $clock): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        $attendance = $clock->clockOut(
            $intern,
            $request->float('latitude'),
            $request->float('longitude'),
            Date::now(),
        )->load(['clockInOffice', 'clockOutOffice']);

        return response()->json([
            'message' => 'Clock out berhasil pukul '.substr((string) $attendance->clock_out_at, 0, 5).'. Terima kasih.',
            'data' => new AttendanceResource($attendance),
        ]);
    }

    /**
     * Riwayat absensi dan rekap satu bulan.
     */
    public function history(AttendanceHistoryRequest $request, AttendanceHistory $history): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        $month = $request->filled('month') ? $request->string('month')->value() : null;

        return response()->json(['data' => $history->month($intern, $month, Date::now())]);
    }

    /**
     * Detail satu hari, hanya baca.
     */
    public function day(Request $request, string $date, AttendanceHistory $history): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        return response()->json(['data' => $history->day($intern, $date, Date::now())]);
    }

    /**
     * Daily Report hari ini. `data` null jika belum dikirim atau belum clock in.
     */
    public function showDailyReport(Request $request, DailyReports $reports): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        $report = $reports->todayAttendance($intern, Date::now())?->dailyReport;

        return response()->json(['data' => $report === null ? null : new DailyReportResource($report)]);
    }

    /**
     * Kirim atau ubah Daily Report hari ini.
     */
    public function saveDailyReport(DailyReportRequest $request, DailyReports $reports): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        [$report, $created] = $reports->save(
            $intern,
            $request->string('work')->value(),
            $request->filled('notes') ? $request->string('notes')->value() : null,
            Date::now(),
        );

        return response()->json([
            'message' => $created ? 'Daily Report terkirim.' : 'Perubahan tersimpan.',
            'data' => new DailyReportResource($report),
        ], $created ? Response::HTTP_CREATED : Response::HTTP_OK);
    }
}
