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
 * Riwayat absensi dan rekap bulanan milik intern sendiri (docs/design-intern.md, Alur 6),
 * dan versi hanya baca untuk mentor di Intern Saya (docs/design-mentor.md, Alur 3) serta
 * admin di detail pengguna (docs/design-admin.md 4.3).
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
        [$month, $months, $days] = $this->resolveMonth($intern, $month, $now);
        [$from, $to] = AttendanceCalendar::monthRange($month);
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
     * Tab Rekap Absensi di Intern Saya (docs/design-mentor.md 5.3). Hanya baca.
     * Tanda Terlambat tidak ditampilkan untuk mentor (keputusan 17 Okt 2026), jadi `late_minutes`
     * dan `recap.late` tidak dikirim. Tidak ada kolom koreksi karena koreksi hak intern dan admin.
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function monthForMentor(User $intern, ?string $month, CarbonInterface $now): array
    {
        [$month, $months, $days] = $this->resolveMonth($intern, $month, $now);

        $recap = $this->calendar->recap($days, $month, $now);
        unset($recap['late']);

        $rows = [];

        foreach (array_reverse($days, preserve_keys: true) as $date => $day) {
            $rows[] = self::withoutLate($this->dayFields($date, $day));
        }

        return [
            'month' => $month,
            'selectable_months' => $months,
            'recap' => $recap,
            'days' => $rows,
        ];
    }

    /**
     * Tab Absensi di detail pengguna admin (docs/design-admin.md 4.3). Hanya baca; admin melihat
     * tanda Terlambat (2.2), koreksi yang masih menunggu, dan isi Daily Report per hari.
     * Admin tidak mengubah absensi langsung, hanya lewat permintaan koreksi (16).
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function monthForAdmin(User $intern, ?string $month, CarbonInterface $now): array
    {
        [$month, $months, $days] = $this->resolveMonth($intern, $month, $now);
        [$from, $to] = AttendanceCalendar::monthRange($month);

        $pendingDates = $intern->attendanceCorrections()
            ->where('status', RequestStatus::Pending)
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->get()
            ->map(fn (AttendanceCorrection $correction): string => $correction->date->toDateString())
            ->all();

        $rows = [];

        foreach (array_reverse($days, preserve_keys: true) as $date => $day) {
            $rows[] = [
                ...$this->dayFields($date, $day),
                'daily_report_work' => $day['attendance']?->dailyReport?->work,
                'has_pending_correction' => in_array($date, $pendingDates, true),
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
     * Tab Daily Report di Intern Saya (docs/design-mentor.md 5.4): satu baris per hari kerja, terbaru lebih dulu.
     * `report_missing` true untuk hari yang sudah clock in tetapi tanpa laporan ("Belum ada laporan").
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function dailyReports(User $intern, ?string $month, CarbonInterface $now): array
    {
        [$month, $months, $days] = $this->resolveMonth($intern, $month, $now);

        $rows = [];

        foreach (array_reverse($days, preserve_keys: true) as $date => $day) {
            if ($day['status'] === AttendanceStatus::Holiday) {
                continue;
            }

            $report = $day['attendance']?->dailyReport;

            $rows[] = [
                'date' => $date,
                'status' => $day['status']->value,
                'leave_type' => $day['status'] === AttendanceStatus::Leave ? $day['leave']?->type->value : null,
                'report' => $report === null ? null : [
                    'work' => $report->work,
                    'notes' => $report->notes,
                    'sent_at' => $report->sent_at->toIso8601String(),
                ],
                'report_missing' => $report === null && $day['attendance'] !== null,
            ];
        }

        return [
            'month' => $month,
            'selectable_months' => $months,
            'days' => $rows,
        ];
    }

    /**
     * Detail satu hari untuk mentor: sama dengan day() tanpa tanda Terlambat.
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function dayForMentor(User $intern, string $date, CarbonInterface $now): array
    {
        return self::withoutLate($this->day($intern, $date, $now));
    }

    /**
     * Bulan yang diminta (default bulan terakhir yang bisa dipilih), rentang pilihan, dan status tiap tanggal.
     *
     * @return array{0: string, 1: array{first: string, last: string}, 2: array<string, array{status: AttendanceStatus, attendance: Attendance|null, late_minutes: int|null, holiday_name: string|null, leave: LeaveRequest|null}>}
     *
     * @throws ValidationException
     */
    private function resolveMonth(User $intern, ?string $month, CarbonInterface $now): array
    {
        $months = $this->selectableMonths($intern, $now);
        $month ??= $months['last'] ?? $now->format('Y-m');

        if ($months === null || $month < $months['first'] || $month > $months['last']) {
            throw ValidationException::withMessages(['month' => self::MONTH_OUTSIDE_PERIOD]);
        }

        [$from, $to] = AttendanceCalendar::monthRange($month);

        return [$month, $months, $this->calendar->days($intern, $from, $to, $now)];
    }

    /**
     * @param  array<string, mixed>  $fields
     * @return array<string, mixed>
     */
    private static function withoutLate(array $fields): array
    {
        unset($fields['late_minutes']);

        return $fields;
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
