<?php

namespace App\Services;

use App\Exceptions\ActionRejected;
use App\Models\Attendance;
use App\Models\DailyReport;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Daily Report intern (docs/design-intern.md, Alur 4).
 * Hanya untuk hari ini, setelah clock in, dan dapat diubah sampai clock out.
 * Hari yang lewat 23:59 tanpa clock out ikut terkunci karena bukan hari ini lagi.
 */
class DailyReports
{
    public const NOT_CLOCKED_IN = 'Clock in dulu untuk mengisi Daily Report.';

    public const LOCKED = 'Laporan terkunci setelah clock out.';

    /**
     * Absensi hari ini beserta laporannya, atau null jika belum clock in.
     */
    public function todayAttendance(User $intern, CarbonInterface $now): ?Attendance
    {
        return $intern->attendances()->with('dailyReport')->whereDate('date', $now->toDateString())->first();
    }

    /**
     * Mengirim laporan pertama atau memperbarui laporan hari ini.
     * Baris absensi dikunci agar tidak bertabrakan dengan clock out yang berjalan bersamaan.
     *
     * @return array{0: DailyReport, 1: bool} laporan dan apakah baru dibuat
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

            // sent_at mengikuti simpanan terakhir ("Terakhir disimpan" di prototipe).
            $report = $attendance->dailyReport()->updateOrCreate([], [
                'work' => $work,
                'notes' => $notes,
                'sent_at' => $now,
            ]);

            return [$report->setRelation('attendance', $attendance), $report->wasRecentlyCreated];
        });
    }
}
