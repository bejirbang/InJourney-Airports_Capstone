<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Enums\TodayState;
use App\Models\Attendance;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\Office;
use App\Models\User;
use App\Models\WorkHourSetting;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * Status kehadiran dihitung saat dibaca, tidak disimpan (backend/CLAUDE.md, "Data yang dihitung").
 * Aturan sama dengan attendanceStatus dan todayState di frontend/src/lib/mock-rules.ts.
 */
class AttendanceCalendar
{
    /**
     * Status satu tanggal (Y-m-d) dengan batas 23:59.
     * Hari yang sudah clock in tetap dihitung hadir walau ada izin disetujui.
     */
    public static function status(string $date, ?Attendance $attendance, bool $holiday, bool $onLeave, string $today): AttendanceStatus
    {
        if ($holiday || Carbon::parse($date)->isWeekend()) {
            return AttendanceStatus::Holiday;
        }

        if ($attendance !== null) {
            if ($attendance->clock_out_at !== null) {
                return AttendanceStatus::Present;
            }

            return $date < $today ? AttendanceStatus::MissedClockOut : AttendanceStatus::Ongoing;
        }

        if ($onLeave) {
            return AttendanceStatus::Leave;
        }

        return $date < $today ? AttendanceStatus::Absent : AttendanceStatus::NotClockedIn;
    }

    /**
     * Status tiap tanggal dari $from sampai $to, dipotong ke periode magang dan tidak melewati hari ini.
     *
     * `late_minutes` null jika belum clock in, jam kerja belum diatur, atau hari itu Libur (misalnya libur
     * yang ditambahkan admin setelah intern clock in): tanpa jam masuk, tidak ada Terlambat.
     * `holiday_name` hanya untuk libur dari admin (akhir pekan null), `leave` izin disetujui yang mencakup hari itu.
     *
     * @return array<string, array{status: AttendanceStatus, attendance: Attendance|null, late_minutes: int|null, holiday_name: string|null, leave: LeaveRequest|null}>
     */
    public function days(User $intern, string $from, string $to, CarbonInterface $today): array
    {
        $profile = $intern->internProfile;

        if ($profile === null) {
            return [];
        }

        $todayDate = $today->toDateString();
        $from = max($from, $profile->start_date->toDateString());
        $to = min($to, $profile->end_date->toDateString(), $todayDate);

        if ($from > $to) {
            return [];
        }

        $attendances = $intern->attendances()
            ->with('dailyReport')
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->get()
            ->keyBy(fn (Attendance $a): string => $a->date->toDateString());

        $holidays = $this->holidayNames($from, $to);
        $leaves = $intern->leaveRequests()->approvedBetween($from, $to)->get();
        $workHours = WorkHourSetting::upTo($to);

        $days = [];

        for ($date = Carbon::parse($from); $date->toDateString() <= $to; $date->addDay()) {
            $day = $date->toDateString();
            $attendance = $attendances->get($day);
            $leave = $leaves->first(fn (LeaveRequest $leave): bool => $leave->covers($day));

            $status = self::status($day, $attendance, isset($holidays[$day]), $leave !== null, $todayDate);

            $days[$day] = [
                'status' => $status,
                'attendance' => $attendance,
                'late_minutes' => $status === AttendanceStatus::Holiday ? null : $attendance?->lateMinutes(WorkHourSetting::pickFor($workHours, $day)),
                'holiday_name' => $holidays[$day] ?? null,
                'leave' => $leave,
            ];
        }

        return $days;
    }

    /**
     * Jumlah hari kerja (bukan Sabtu, Minggu, atau libur admin) dari $from sampai $to (Y-m-d), inklusif.
     * Dihitung saat dibaca, jadi libur yang ditambahkan belakangan ikut diperhitungkan.
     */
    public function workingDays(string $from, string $to): int
    {
        if ($from > $to) {
            return 0;
        }

        $holidays = $this->holidayNames($from, $to);
        $count = 0;

        for ($date = Carbon::parse($from); $date->toDateString() <= $to; $date->addDay()) {
            if (! $date->isWeekend() && ! isset($holidays[$date->toDateString()])) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * Tanggal pertama dan terakhir bulan $month (Y-m).
     *
     * @return array{0: string, 1: string}
     */
    public static function monthRange(string $month): array
    {
        $start = Carbon::createFromFormat('!Y-m', $month);

        return [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()];
    }

    /**
     * Rekap bulan berjalan untuk dashboard (docs/design-intern.md, bagian 4.2).
     *
     * @return array{month: string, present: int, leave: int, absent: int, missed_clock_out: int, late: int, working_days: int}
     */
    public function monthlyRecap(User $intern, CarbonInterface $today): array
    {
        $month = $today->format('Y-m');
        [$from, $to] = self::monthRange($month);

        return $this->recap($this->days($intern, $from, $to, $today), $month, $today);
    }

    /**
     * Rekap dari hasil days(). Hanya status final: hari ini belum dihitung sampai lewat 23:59,
     * dan hari libur tidak dihitung hari kerja. `late` menghitung hari dengan clock in terlambat
     * (Hadir atau Lupa Clock Out); bukan status tersendiri.
     *
     * @param  array<string, array{status: AttendanceStatus, late_minutes: int|null}>  $days
     * @return array{month: string, present: int, leave: int, absent: int, missed_clock_out: int, late: int, working_days: int}
     */
    public function recap(array $days, string $month, CarbonInterface $today): array
    {
        $todayDate = $today->toDateString();
        $final = array_filter(
            $days,
            fn (array $day, string $date): bool => $date < $todayDate && $day['status'] !== AttendanceStatus::Holiday,
            ARRAY_FILTER_USE_BOTH,
        );
        $count = fn (AttendanceStatus $status): int => count(array_filter(
            $final,
            fn (array $day): bool => $day['status'] === $status,
        ));

        return [
            'month' => $month,
            'present' => $count(AttendanceStatus::Present),
            'leave' => $count(AttendanceStatus::Leave),
            'absent' => $count(AttendanceStatus::Absent),
            'missed_clock_out' => $count(AttendanceStatus::MissedClockOut),
            'late' => count(array_filter($final, fn (array $day): bool => ($day['late_minutes'] ?? 0) > 0)),
            'working_days' => count($final),
        ];
    }

    /**
     * Isi kartu Hari Ini (docs/design-intern.md, bagian 4.3).
     *
     * @return array{state: TodayState, clock_in_at: string|null, clock_out_at: string|null, late_minutes: int|null, daily_report_sent: bool, holiday_name: string|null, leave_type: string|null, has_active_office: bool, work_hours: array{start: string, end: string}|null}
     */
    public function today(User $intern, CarbonInterface $today): array
    {
        $date = $today->toDateString();
        $profile = $intern->internProfile;
        $inPeriod = $profile !== null
            && $profile->start_date->toDateString() <= $date
            && $date <= $profile->end_date->toDateString();

        $holidayName = $this->holidayNames($date, $date)[$date] ?? null;
        $workday = $holidayName === null && ! $today->isWeekend();

        $attendance = $intern->attendances()->with('dailyReport')->whereDate('date', $date)->first();
        $leave = $intern->leaveRequests()->approvedBetween($date, $date)->first();

        $workHours = WorkHourSetting::effectiveOn($date);

        $state = match (true) {
            ! $inPeriod => TodayState::OutsidePeriod,
            ! $workday => TodayState::Holiday,
            $attendance !== null => $attendance->clock_out_at !== null ? TodayState::ClockedOut : TodayState::ClockedIn,
            $leave !== null => TodayState::OnLeave,
            default => TodayState::NotClockedIn,
        };

        return [
            'state' => $state,
            'clock_in_at' => self::time($attendance?->clock_in_at),
            'clock_out_at' => self::time($attendance?->clock_out_at),
            'late_minutes' => $attendance?->lateMinutes($workHours),
            'daily_report_sent' => $attendance?->dailyReport !== null,
            'holiday_name' => $state === TodayState::Holiday ? $holidayName : null,
            // OnLeave hanya terjadi jika $leave ada.
            'leave_type' => $state === TodayState::OnLeave ? $leave->type->value : null,
            // Tanpa kantor aktif, tombol Clock In tidak aktif (docs/design-intern.md, bagian 5.3).
            'has_active_office' => Office::query()->active()->exists(),
            // Null jika admin belum mengatur jam kerja.
            'work_hours' => $workHours?->toHours(),
        ];
    }

    /**
     * @return array<string, string> nama libur per tanggal Y-m-d
     */
    private function holidayNames(string $from, string $to): array
    {
        return Holiday::query()
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->get()
            ->mapWithKeys(fn (Holiday $holiday): array => [$holiday->date->toDateString() => $holiday->name])
            ->all();
    }

    /**
     * Jam 24 jam tanpa detik, misalnya "08:02".
     */
    private static function time(?string $time): ?string
    {
        return $time === null ? null : substr($time, 0, 5);
    }
}
