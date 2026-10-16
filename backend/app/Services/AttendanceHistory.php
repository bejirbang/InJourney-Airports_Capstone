<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Enums\RequestStatus;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\LeaveRequest;
use App\Models\Office;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

/**
 * Riwayat absensi dan rekap bulanan milik intern sendiri (docs/design-intern.md, Alur 6).
 */
class AttendanceHistory
{
    public const MONTH_OUTSIDE_PERIOD = 'Bulan di luar periode magang.';

    public const DATE_UNAVAILABLE = 'Tanggal di luar periode magang atau belum berjalan.';

    /**
     * Status yang boleh diajukan koreksi: hari kerja yang sudah lewat, selain Izin.
     */
    private const CORRECTABLE = [AttendanceStatus::Present, AttendanceStatus::MissedClockOut, AttendanceStatus::Absent];

    public function __construct(private AttendanceCalendar $calendar) {}

    /**
     * Bulan yang bisa dipilih: dari bulan mulai magang sampai bulan berjalan
     * (atau bulan selesai magang jika lebih awal). Bulan di luar itu tidak bisa dipilih.
     *
     * @return array{first: string, last: string}|null
     */
    public function selectableMonths(User $intern, CarbonInterface $now): ?array
    {
        $profile = $intern->internProfile;

        if ($profile === null) {
            return null;
        }

        return [
            'first' => $profile->start_date->format('Y-m'),
            'last' => min($profile->end_date->format('Y-m'), $now->format('Y-m')),
        ];
    }

    /**
     * Rekap dan baris harian satu bulan, tanggal terbaru lebih dulu. Tanpa $month, bulan terakhir yang bisa dipilih.
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function month(User $intern, ?string $month, CarbonInterface $now): array
    {
        $months = $this->selectableMonths($intern, $now);
        $month ??= $months['last'] ?? $now->format('Y-m');

        if ($months === null || $month < $months['first'] || $month > $months['last']) {
            throw ValidationException::withMessages(['month' => self::MONTH_OUTSIDE_PERIOD]);
        }

        [$from, $to] = AttendanceCalendar::monthRange($month);
        $days = $this->calendar->days($intern, $from, $to, $now);
        $today = $now->toDateString();

        // Satu tanggal hanya boleh punya satu koreksi Pending.
        $pendingDates = $intern->attendanceCorrections()
            ->where('status', RequestStatus::Pending)
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->get()
            ->map(fn (AttendanceCorrection $correction): string => $correction->date->toDateString())
            ->all();

        $rows = [];

        foreach (array_reverse($days, preserve_keys: true) as $date => $day) {
            $pending = in_array($date, $pendingDates, true);

            $rows[] = [
                ...$this->dayFields($date, $day),
                'has_pending_correction' => $pending,
                'can_request_correction' => ! $pending && $date < $today && in_array($day['status'], self::CORRECTABLE, true),
            ];
        }

        return [
            'month' => $month,
            'selectable_months' => $months,
            'recap' => $this->calendar->recap($days, $month, $now),
            'days' => $rows,
        ];
    }

    /**
     * Detail satu hari, hanya baca: jam, status, kantor, dan Daily Report.
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function day(User $intern, string $date, CarbonInterface $now): array
    {
        $valid = preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $parts) === 1
            && checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]);
        $day = $valid ? ($this->calendar->days($intern, $date, $date, $now)[$date] ?? null) : null;

        if ($day === null) {
            throw ValidationException::withMessages(['date' => self::DATE_UNAVAILABLE]);
        }

        $attendance = $day['attendance']?->loadMissing(['clockInOffice', 'clockOutOffice']);
        $report = $attendance?->dailyReport;

        return [
            ...$this->dayFields($date, $day),
            'clock_in_office' => self::office($attendance?->clockInOffice),
            'clock_out_office' => self::office($attendance?->clockOutOffice),
            'daily_report' => $report === null ? null : [
                'work' => $report->work,
                'notes' => $report->notes,
                'sent_at' => $report->sent_at->toIso8601String(),
            ],
        ];
    }

    /**
     * @param  array{status: AttendanceStatus, attendance: Attendance|null, late_minutes: int|null, holiday_name: string|null, leave: LeaveRequest|null}  $day
     * @return array<string, mixed>
     */
    private function dayFields(string $date, array $day): array
    {
        $attendance = $day['attendance'];

        return [
            'date' => $date,
            'status' => $day['status']->value,
            'clock_in_at' => $attendance === null ? null : substr($attendance->clock_in_at, 0, 5),
            'clock_out_at' => $attendance?->clock_out_at === null ? null : substr($attendance->clock_out_at, 0, 5),
            'late_minutes' => $day['late_minutes'],
            // Label "Dikoreksi admin".
            'is_corrected' => $attendance !== null && $attendance->is_corrected,
            'daily_report_sent' => $attendance?->dailyReport !== null,
            'holiday_name' => $day['status'] === AttendanceStatus::Holiday ? $day['holiday_name'] : null,
            'leave_type' => $day['status'] === AttendanceStatus::Leave ? $day['leave']?->type->value : null,
        ];
    }

    /**
     * @return array{id: int, name: string}|null
     */
    private static function office(?Office $office): ?array
    {
        return $office === null ? null : ['id' => $office->id, 'name' => $office->name];
    }
}
