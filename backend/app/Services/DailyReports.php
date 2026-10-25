<?php

namespace App\Services;

use App\Enums\LogbookStatus;
use App\Exceptions\ActionRejected;
use App\Models\Attendance;
use App\Models\Logbook;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Hari yang lewat 23:59 tanpa clock out ikut terkunci karena bukan hari ini lagi.
 */
class DailyReports
{
    public const NOT_CLOCKED_IN = 'Clock in dulu untuk mengisi Daily Report.';

    public const LOCKED = 'Laporan terkunci setelah clock out.';

    public function todayAttendance(User $intern, CarbonInterface $now): ?Attendance
    {
        return $intern->attendances()->with('logbook')->whereDate('date', $now->toDateString())->first();
    }

    /**
     * Baris absensi dikunci agar tidak bertabrakan dengan clock out yang berjalan bersamaan.
     *
     * @return array{0: Logbook, 1: bool}
     *
     * @throws ActionRejected
     */
    public function save(User $intern, string $work, ?string $notes, CarbonInterface $now): array
    {
        return DB::transaction(function () use ($intern, $work, $notes, $now): array {
            $attendance = $intern->attendances()
                ->whereDate('date', $now->toDateString())
                ->lockForUpdate()
                ->first();

            if ($attendance === null) {
                throw new ActionRejected(self::NOT_CLOCKED_IN, 'not_clocked_in');
            }

            if ($attendance->clock_out_at !== null) {
                throw new ActionRejected(self::LOCKED, 'clocked_out');
            }

            $report = $attendance->logbook()->updateOrCreate([], [
                'work' => $work,
                'notes' => $notes,
                'status' => LogbookStatus::Draft,
            ]);

            return [$report->setRelation('attendance', $attendance), $report->wasRecentlyCreated];
        });
    }
}
