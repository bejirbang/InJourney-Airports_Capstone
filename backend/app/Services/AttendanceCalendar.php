<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Enums\TodayState;
use App\Models\Attendance;
use App\Models\LeaveRequest;
use App\Models\Office;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

class AttendanceCalendar
{
    public function __construct(private WorkSchedules $schedules) {}

    /**
     * Hari yang sudah clock in tetap dihitung hadir walau ada izin disetujui. $off berarti hari libur
     * atau bukan hari kerja menurut jadwal bandara.
     */
    public static function status(string $date, ?Attendance $attendance, bool $off, bool $onLeave, string $today): AttendanceStatus
    {
        if ($off) {
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
     * `late_minutes` null jika belum clock in atau hari itu Libur (misalnya libur yang ditambahkan admin
     * setelah intern clock in).
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
            ->with('logbook')
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->get()
            ->keyBy(fn (Attendance $a): string => $a->date->toDateString());

        $schedules = $this->schedules->betweenForIntern($intern, $from, $to);
        $leaves = $intern->leaveRequests()->approvedBetween($from, $to)->get();

        $days = [];

        for ($date = Carbon::parse($from); $date->toDateString() <= $to; $date->addDay()) {
            $day = $date->toDateString();
            $attendance = $attendances->get($day);
            $leave = $leaves->first(fn (LeaveRequest $leave): bool => $leave->covers($day));

            $schedule = $schedules[$day];
            $status = self::status($day, $attendance, ! $schedule->isWorkday, $leave !== null, $todayDate);

            $days[$day] = [
                'status' => $status,
                'attendance' => $attendance,
                'late_minutes' => $status === AttendanceStatus::Holiday ? null : $attendance?->lateMinutes(),
                'holiday_name' => $schedule->holidayName,
                'leave' => $leave,
            ];
        }

        return $days;
    }

    /**
     * @return array{0: string, 1: string}
     */
    public static function monthRange(string $month): array
    {
        $start = Carbon::createFromFormat('!Y-m', $month);

        return [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()];
    }

    /**
     * @return array{month: string, present: int, leave: int, absent: int, missed_clock_out: int, late: int, working_days: int}
     */
    public function monthlyRecap(User $intern, CarbonInterface $today): array
    {
        $month = $today->format('Y-m');
        [$from, $to] = self::monthRange($month);

        return $this->recap($this->days($intern, $from, $to, $today), $month, $today);
    }

    /**
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
     * @return array{state: TodayState, clock_in_at: string|null, clock_out_at: string|null, late_minutes: int|null, daily_report_sent: bool, holiday_name: string|null, leave_type: string|null, has_active_office: bool, work_hours: array{start: string, end: string}|null}
     */
    public function today(User $intern, CarbonInterface $today): array
    {
        $date = $today->toDateString();
        $profile = $intern->internProfile;
        $inPeriod = $profile !== null
            && $profile->start_date->toDateString() <= $date
            && $date <= $profile->end_date->toDateString();

        $schedule = $this->schedules->forIntern($intern, $date);

        $attendance = $intern->attendances()->with('logbook')->whereDate('date', $date)->first();
        $leave = $intern->leaveRequests()->approvedBetween($date, $date)->first();

        $state = match (true) {
            ! $inPeriod => TodayState::OutsidePeriod,
            ! $schedule->isWorkday => TodayState::Holiday,
            $attendance !== null => $attendance->clock_out_at !== null ? TodayState::ClockedOut : TodayState::ClockedIn,
            $leave !== null => TodayState::OnLeave,
            default => TodayState::NotClockedIn,
        };

        return [
            'state' => $state,
            'clock_in_at' => self::time($attendance?->clock_in_at),
            'clock_out_at' => self::time($attendance?->clock_out_at),
            'late_minutes' => $attendance?->lateMinutes(),
            'daily_report_sent' => $attendance?->logbook !== null,
            'holiday_name' => $state === TodayState::Holiday ? $schedule->holidayName : null,
            'leave_type' => $state === TodayState::OnLeave ? $leave->type->value : null,
            'has_active_office' => Office::query()->active()->exists(),
            'work_hours' => $schedule->hours(),
        ];
    }

    private static function time(?string $time): ?string
    {
        return $time === null ? null : substr($time, 0, 5);
    }
}
