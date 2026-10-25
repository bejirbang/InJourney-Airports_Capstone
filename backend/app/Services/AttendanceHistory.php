<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Models\AttendanceCorrection;
use App\Models\Office;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

/**
 * @phpstan-import-type CalendarDay from AttendanceCalendar
 */
class AttendanceHistory
{
    public const MONTH_OUTSIDE_PERIOD = 'Bulan di luar periode magang.';

    public const DATE_UNAVAILABLE = 'Tanggal di luar periode magang atau belum berjalan.';

    /** Filter Riwayat: status presensi, ditambah tanda Lupa Clock Out (kotak rekap di Dashboard). */
    public const FILTER_MISSED_CLOCK_OUT = 'missed_clock_out';

    public const FILTERS = ['present', 'late', 'missed_clock_in', 'leave', 'absent', 'holiday', self::FILTER_MISSED_CLOCK_OUT];

    private const CORRECTABLE = [AttendanceStatus::Late, AttendanceStatus::MissedClockIn, AttendanceStatus::Absent];

    public function __construct(private AttendanceCalendar $calendar) {}

    /**
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
     * Pengajuan koreksi sah untuk hari kerja yang sudah lewat dengan status Terlambat, Lupa Clock In,
     * Tidak Hadir, atau bertanda Lupa Clock Out.
     *
     * @param  CalendarDay  $day
     */
    public static function correctable(string $date, array $day, string $today): bool
    {
        return $date < $today && (in_array($day['status'], self::CORRECTABLE, true) || $day['missed_clock_out']);
    }

    /**
     * Riwayat Intern. Rekap selalu sebulan penuh walau daftar hari difilter.
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function month(User $intern, ?string $month, ?string $filter, CarbonInterface $now): array
    {
        [$month, $months, $days] = $this->resolveMonth($intern, $month, $now);
        $activeDates = $this->activeCorrectionDates($intern, $month);
        $today = $now->toDateString();
        $rows = [];

        foreach ($this->filtered($days, $filter) as $date => $day) {
            $active = in_array($date, $activeDates, true);

            $rows[] = [
                ...$this->dayFields($date, $day),
                'has_active_correction' => $active,
                'can_request_correction' => ! $active && self::correctable($date, $day, $today),
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
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function monthForMentor(User $intern, ?string $month, ?string $filter, CarbonInterface $now): array
    {
        [$month, $months, $days] = $this->resolveMonth($intern, $month, $now);
        $rows = [];

        foreach ($this->filtered($days, $filter) as $date => $day) {
            $rows[] = $this->dayFields($date, $day);
        }

        return [
            'month' => $month,
            'selectable_months' => $months,
            'recap' => $this->calendar->recap($days, $month, $now),
            'days' => $rows,
        ];
    }

    /**
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function monthForAdmin(User $intern, ?string $month, ?string $filter, CarbonInterface $now): array
    {
        [$month, $months, $days] = $this->resolveMonth($intern, $month, $now);
        $activeDates = $this->activeCorrectionDates($intern, $month);
        $rows = [];

        foreach ($this->filtered($days, $filter) as $date => $day) {
            $rows[] = [
                ...$this->dayFields($date, $day),
                'logbook_work' => $day['attendance']?->logbook?->work,
                'has_active_correction' => in_array($date, $activeDates, true),
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
     * Tab Logbook di detail intern milik mentor: satu baris per hari kerja.
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function logbooks(User $intern, ?string $month, CarbonInterface $now): array
    {
        [$month, $months, $days] = $this->resolveMonth($intern, $month, $now);
        $rows = [];

        foreach (array_reverse($days, preserve_keys: true) as $date => $day) {
            if ($day['status'] === AttendanceStatus::Holiday) {
                continue;
            }

            $logbook = $day['attendance']?->logbook;

            $rows[] = [
                'date' => $date,
                'status' => $day['status']->value,
                'leave_type' => $day['leave']?->type->value,
                'logbook_state' => InternLogbooks::state($day['attendance']),
                'logbook' => $logbook === null ? null : [
                    'work' => $logbook->work,
                    'notes' => $logbook->notes,
                    'status' => $logbook->status->value,
                    'submitted_at' => $logbook->submitted_at?->toIso8601String(),
                ],
            ];
        }

        return [
            'month' => $month,
            'selectable_months' => $months,
            'days' => $rows,
        ];
    }

    /**
     * Detail satu hari, sama untuk intern, mentor, dan admin.
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function day(User $intern, string $date, CarbonInterface $now): array
    {
        $day = $this->validDay($intern, $date, $now);
        $attendance = $day['attendance']?->loadMissing(['clockInOffice', 'clockOutOffice']);
        $logbook = $attendance?->logbook;

        return [
            ...$this->dayFields($date, $day),
            'scheduled' => $attendance === null ? null : [
                'start' => substr($attendance->scheduled_start, 0, 5),
                'end' => substr($attendance->scheduled_end, 0, 5),
            ],
            'clock_in_office' => self::office($attendance?->clockInOffice),
            'clock_out_office' => self::office($attendance?->clockOutOffice),
            'logbook' => $logbook === null ? null : [
                'work' => $logbook->work,
                'notes' => $logbook->notes,
                'status' => $logbook->status->value,
                'submitted_at' => $logbook->submitted_at?->toIso8601String(),
            ],
        ];
    }

    /**
     * @return CalendarDay
     *
     * @throws ValidationException
     */
    public function validDay(User $intern, string $date, CarbonInterface $now): array
    {
        $valid = preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $parts) === 1
            && checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]);
        $day = $valid ? ($this->calendar->days($intern, $date, $date, $now)[$date] ?? null) : null;

        if ($day === null) {
            throw ValidationException::withMessages(['date' => self::DATE_UNAVAILABLE]);
        }

        return $day;
    }

    /**
     * @return array{0: string, 1: array{first: string, last: string}, 2: array<string, CalendarDay>}
     *
     * @throws ValidationException
     */
    public function resolveMonth(User $intern, ?string $month, CarbonInterface $now): array
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
     * Terbaru lebih dulu.
     *
     * @param  array<string, CalendarDay>  $days
     * @return array<string, CalendarDay>
     */
    private function filtered(array $days, ?string $filter): array
    {
        return array_filter(
            array_reverse($days, preserve_keys: true),
            fn (array $day): bool => match ($filter) {
                null => true,
                self::FILTER_MISSED_CLOCK_OUT => $day['missed_clock_out'],
                default => $day['status']->value === $filter,
            },
        );
    }

    /**
     * @return list<string>
     */
    private function activeCorrectionDates(User $intern, string $month): array
    {
        [$from, $to] = AttendanceCalendar::monthRange($month);

        return array_values($intern->attendanceCorrections()
            ->active()
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->get()
            ->map(fn (AttendanceCorrection $correction): string => $correction->date->toDateString())
            ->all());
    }

    /**
     * @param  CalendarDay  $day
     * @return array<string, mixed>
     */
    private function dayFields(string $date, array $day): array
    {
        $attendance = $day['attendance'];
        $holiday = $day['status'] === AttendanceStatus::Holiday;

        return [
            'date' => $date,
            'status' => $day['status']->value,
            'clock_in_at' => $attendance?->clock_in_at === null ? null : substr($attendance->clock_in_at, 0, 5),
            'clock_out_at' => $attendance?->clock_out_at === null ? null : substr($attendance->clock_out_at, 0, 5),
            'late_minutes' => $day['late_minutes'],
            'missed_clock_out' => $day['missed_clock_out'],
            'is_corrected' => $day['is_corrected'],
            'logbook_state' => $holiday ? null : InternLogbooks::state($attendance),
            'holiday_name' => $holiday ? $day['holiday_name'] : null,
            'leave_type' => $day['leave']?->type->value,
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
