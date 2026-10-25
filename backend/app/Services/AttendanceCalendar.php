<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Enums\TodayState;
use App\Models\Attendance;
use App\Models\LeaveRequest;
use App\Models\Office;
use App\Models\User;
use App\Support\DaySchedule;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * Status presensi dihitung saat dibaca dengan batas hari 23:59, tidak disimpan.
 *
 * @phpstan-type CalendarDay array{status: AttendanceStatus, attendance: Attendance|null, late_minutes: int|null, missed_clock_out: bool, is_corrected: bool, holiday_name: string|null, leave: LeaveRequest|null}
 * @phpstan-type StatusDay array{intern: User, status: AttendanceStatus, attendance: Attendance|null, leave: LeaveRequest|null, missed_clock_out: bool, schedule: DaySchedule}
 * @phpstan-type Recap array{month: string, present: int, late: int, missed_clock_in: int, leave: int, absent: int, missed_clock_out: int, corrected: int, working_days: int}
 */
class AttendanceCalendar
{
    public function __construct(private WorkSchedules $schedules) {}

    /**
     * Izin hanya berlaku jika tidak ada baris presensi: hari yang sempat clock in mengikuti presensinya.
     * $off berarti hari libur atau bukan hari kerja menurut jadwal bandara.
     */
    public static function status(string $date, ?Attendance $attendance, bool $off, bool $onLeave, string $today): AttendanceStatus
    {
        return match (true) {
            $off => AttendanceStatus::Holiday,
            $attendance !== null => $attendance->status(),
            $onLeave => AttendanceStatus::Leave,
            $date < $today => AttendanceStatus::Absent,
            default => AttendanceStatus::NotClockedIn,
        };
    }

    /**
     * @return array<string, CalendarDay>
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
            $attended = $status->isAttended();

            $days[$day] = [
                'status' => $status,
                'attendance' => $attendance,
                'late_minutes' => $status === AttendanceStatus::Late ? $attendance?->lateMinutes() : null,
                'missed_clock_out' => $attended && $attendance !== null && $attendance->missedClockOut($todayDate),
                'is_corrected' => $attended && $attendance !== null && $attendance->is_corrected,
                'holiday_name' => $schedule->holidayName,
                'leave' => $status === AttendanceStatus::Leave ? $leave : null,
            ];
        }

        return $days;
    }

    /**
     * Status satu tanggal untuk banyak intern sekaligus, masing-masing dengan jadwal bandaranya. Intern di luar
     * periode magang pada tanggal itu dilewati.
     *
     * @param  iterable<User>  $interns  dengan `internProfile`
     * @return array<int, StatusDay>
     */
    public function statusesOn(iterable $interns, string $date, CarbonInterface $now): array
    {
        $inPeriod = [];

        foreach ($interns as $intern) {
            $profile = $intern->internProfile;

            if ($profile !== null && $profile->start_date->toDateString() <= $date && $date <= $profile->end_date->toDateString()) {
                $inPeriod[$intern->id] = $intern;
            }
        }

        if ($inPeriod === []) {
            return [];
        }

        $ids = array_keys($inPeriod);
        $attendances = Attendance::query()->whereIn('intern_id', $ids)->whereDate('date', $date)->get()->keyBy('intern_id');
        $leaves = LeaveRequest::query()->whereIn('intern_id', $ids)->approvedBetween($date, $date)->get()->keyBy('intern_id');
        $today = $now->toDateString();
        $schedules = [];
        $days = [];

        foreach ($inPeriod as $id => $intern) {
            $airportId = (int) $intern->internProfile?->airport_id;
            $schedule = $schedules[$airportId] ??= $this->schedules->forDate($airportId, $date);
            $attendance = $attendances->get($id);
            $leave = $leaves->get($id);
            $status = self::status($date, $attendance, ! $schedule->isWorkday, $leave !== null, $today);

            $days[$id] = [
                'intern' => $intern,
                'status' => $status,
                'attendance' => $status->isAttended() ? $attendance : null,
                'leave' => $status === AttendanceStatus::Leave ? $leave : null,
                'missed_clock_out' => $status->isAttended() && $attendance !== null && $attendance->missedClockOut($today),
                'schedule' => $schedule,
            ];
        }

        return $days;
    }

    /**
     * Baris nama di kartu Dashboard (klik kotak untuk melihat nama).
     *
     * @param  StatusDay  $day
     * @return array<string, mixed>
     */
    public static function dayRow(array $day): array
    {
        $intern = $day['intern'];
        $attendance = $day['attendance'];

        return [
            'intern' => ['id' => $intern->id, 'name' => $intern->name, 'short_name' => $intern->shortName()],
            'status' => $day['status']->value,
            'clock_in_at' => self::time($attendance?->clock_in_at),
            'late_minutes' => $day['status'] === AttendanceStatus::Late ? $attendance?->lateMinutes() : null,
            'missed_clock_out' => $day['missed_clock_out'],
            'leave_type' => $day['leave']?->type->value,
        ];
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
     * @return Recap
     */
    public function monthlyRecap(User $intern, CarbonInterface $today): array
    {
        $month = $today->format('Y-m');
        [$from, $to] = self::monthRange($month);

        return $this->recap($this->days($intern, $from, $to, $today), $month, $today);
    }

    /**
     * Hanya hari kerja yang sudah final (sebelum hari ini). Hadir, Terlambat, dan Lupa Clock In
     * dihitung terpisah; ketiganya terhitung hadir.
     *
     * @param  array<string, CalendarDay>  $days
     * @return Recap
     */
    public function recap(array $days, string $month, CarbonInterface $today): array
    {
        $todayDate = $today->toDateString();
        $final = array_filter(
            $days,
            fn (array $day, string $date): bool => $date < $todayDate && $day['status'] !== AttendanceStatus::Holiday,
            ARRAY_FILTER_USE_BOTH,
        );
        $count = fn (callable $match): int => count(array_filter($final, $match));
        $status = fn (AttendanceStatus $status): int => $count(fn (array $day): bool => $day['status'] === $status);

        return [
            'month' => $month,
            'present' => $status(AttendanceStatus::Present),
            'late' => $status(AttendanceStatus::Late),
            'missed_clock_in' => $status(AttendanceStatus::MissedClockIn),
            'leave' => $status(AttendanceStatus::Leave),
            'absent' => $status(AttendanceStatus::Absent),
            'missed_clock_out' => $count(fn (array $day): bool => $day['missed_clock_out']),
            'corrected' => $count(fn (array $day): bool => $day['is_corrected']),
            'working_days' => count($final),
        ];
    }

    /**
     * Kartu Hari Ini. Clock out boleh mulai jam pulang: jam salinan di baris presensi jika sudah clock in,
     * selain itu jam jadwal hari ini.
     *
     * @return array{state: TodayState, schedule: array{start: string, end: string}|null, status: string|null, clock_in_at: string|null, clock_out_at: string|null, late_minutes: int|null, clock_out_from: string|null, can_clock_out: bool, logbook: array{status: string, work: string, notes: string|null}|null, holiday_name: string|null, leave_type: string|null, has_active_office: bool}
     */
    public function today(User $intern, CarbonInterface $now): array
    {
        $date = $now->toDateString();
        $profile = $intern->internProfile;
        $inPeriod = $profile !== null
            && $profile->start_date->toDateString() <= $date
            && $date <= $profile->end_date->toDateString();

        $schedule = $this->schedules->forIntern($intern, $date);
        $attendance = $intern->attendances()->with('logbook')->whereDate('date', $date)->first();
        $leave = $intern->leaveRequests()->approvedBetween($date, $date)->first();

        $workEnd = $attendance->scheduled_end ?? $schedule->end;
        $afterWorkEnd = $workEnd !== null && $now->format('H:i:s') >= $workEnd;

        $state = match (true) {
            ! $inPeriod => TodayState::OutsidePeriod,
            ! $schedule->isWorkday => TodayState::Holiday,
            $attendance !== null => $attendance->clock_out_at !== null ? TodayState::ClockedOut : TodayState::ClockedIn,
            $leave !== null => TodayState::OnLeave,
            $afterWorkEnd => TodayState::MissedClockIn,
            default => TodayState::NotClockedIn,
        };

        $logbook = $attendance?->logbook;

        return [
            'state' => $state,
            'schedule' => $schedule->hours(),
            'status' => $attendance === null || $state === TodayState::Holiday ? null : $attendance->status()->value,
            'clock_in_at' => self::time($attendance?->clock_in_at),
            'clock_out_at' => self::time($attendance?->clock_out_at),
            'late_minutes' => $attendance?->lateMinutes(),
            'clock_out_from' => in_array($state, [TodayState::NotClockedIn, TodayState::ClockedIn, TodayState::MissedClockIn], true) ? self::time($workEnd) : null,
            'can_clock_out' => $afterWorkEnd && in_array($state, [TodayState::ClockedIn, TodayState::MissedClockIn], true),
            'logbook' => $logbook === null ? null : ['status' => $logbook->status->value, 'work' => $logbook->work, 'notes' => $logbook->notes],
            'holiday_name' => $state === TodayState::Holiday ? $schedule->holidayName : null,
            'leave_type' => $state === TodayState::OnLeave ? $leave->type->value : null,
            'has_active_office' => $profile !== null && Office::query()->active()->where('airport_id', $profile->airport_id)->exists(),
        ];
    }

    private static function time(?string $time): ?string
    {
        return $time === null ? null : substr($time, 0, 5);
    }
}
