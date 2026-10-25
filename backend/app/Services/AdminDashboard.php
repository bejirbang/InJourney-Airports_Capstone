<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Enums\CorrectionStatus;
use App\Enums\Role;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\Holiday;
use App\Models\InternProfile;
use App\Models\LeaveRequest;
use App\Models\Office;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class AdminDashboard
{
    public const LIST_LIMIT = 5;

    private const HOLIDAY_LOOKBACK_DAYS = 60;

    public function __construct(private EndingInternships $endings) {}

    /**
     * @return array<string, mixed>
     */
    public function for(CarbonInterface $now): array
    {
        $date = $now->toDateString();
        $holidayName = Holiday::query()->whereDate('date', $date)->value('name');
        $isHoliday = $holidayName !== null || $now->isWeekend();

        return [
            'date' => $date,
            'holiday' => $isHoliday ? ['name' => $holidayName] : null,
            'has_active_office' => Office::query()->active()->exists(),
            'today' => $isHoliday ? null : $this->today($date),
            'yesterday' => $this->yesterday($now),
            'overdue_leaves' => $this->overdueLeaves($now),
            'pending_corrections' => $this->pendingCorrections(),
            'ending_internships' => $this->endingInternships($now),
        ];
    }

    /**
     * @return array{interns: int, clocked_in: int, on_leave: int, not_clocked_in: int, late: int, late_interns: list<array<string, mixed>>}
     */
    private function today(string $date): array
    {
        $ids = $this->internIdsOn($date);

        $attendances = Attendance::query()
            ->with('intern:id,name')
            ->whereIn('intern_id', $ids)
            ->whereDate('date', $date)
            ->get();

        $clockedIn = $attendances->pluck('intern_id')->unique();

        // Hari yang sudah clock in tetap dihitung Sudah Clock In walau ada izin disetujui.
        $onLeave = LeaveRequest::query()
            ->whereIn('intern_id', $ids->diff($clockedIn))
            ->approvedBetween($date, $date)
            ->pluck('intern_id')
            ->unique();

        $late = array_values($attendances
            ->map(fn (Attendance $attendance): array => [
                'intern' => $this->person($attendance->intern),
                'clock_in_at' => substr((string) $attendance->clock_in_at, 0, 5),
                'late_minutes' => (int) $attendance->lateMinutes(),
            ])
            ->filter(fn (array $row): bool => $row['late_minutes'] > 0)
            ->sortBy([['clock_in_at', 'asc'], ['intern.name', 'asc']])
            ->all());

        return [
            'interns' => $ids->count(),
            'clocked_in' => $clockedIn->count(),
            'on_leave' => $onLeave->count(),
            'not_clocked_in' => $ids->count() - $clockedIn->count() - $onLeave->count(),
            'late' => count($late),
            'late_interns' => $late,
        ];
    }

    /**
     * @return array{date: string, present: int, leave: int, absent: int, missed_clock_out: int}
     */
    private function yesterday(CarbonInterface $now): array
    {
        $today = $now->toDateString();
        $date = $this->previousWorkingDay($today);
        $ids = $this->internIdsOn($date);

        $attendances = Attendance::query()
            ->whereIn('intern_id', $ids)
            ->whereDate('date', $date)
            ->get()
            ->keyBy('intern_id');

        $onLeave = LeaveRequest::query()
            ->whereIn('intern_id', $ids)
            ->approvedBetween($date, $date)
            ->pluck('intern_id')
            ->flip();

        $statuses = $ids->map(fn (int $id): AttendanceStatus => AttendanceCalendar::status(
            $date, $attendances->get($id), false, $onLeave->has($id), $today,
        ));

        $count = fn (AttendanceStatus $status): int => $statuses->filter(fn (AttendanceStatus $s): bool => $s === $status)->count();

        return [
            'date' => $date,
            'present' => $count(AttendanceStatus::Present),
            'leave' => $count(AttendanceStatus::Leave),
            'absent' => $count(AttendanceStatus::Absent),
            'missed_clock_out' => $count(AttendanceStatus::MissedClockOut),
        ];
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function overdueLeaves(CarbonInterface $now): array
    {
        $query = LeaveRequest::query()->overduePending($now)->whereHas('intern');

        $ordered = $query->clone()->with('intern:id,name')->orderBy('created_at')->orderBy('id');

        return $this->box($query, $ordered, fn (LeaveRequest $leave): array => [
            'id' => $leave->id,
            'intern' => $this->person($leave->intern),
            'type' => $leave->type->value,
            'start_date' => $leave->start_date->toDateString(),
            'end_date' => $leave->end_date->toDateString(),
            'created_at' => $leave->created_at?->toIso8601String(),
            'pending_hours' => $leave->pendingHours($now),
        ]);
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function pendingCorrections(): array
    {
        $query = AttendanceCorrection::query()->where('status', CorrectionStatus::PendingAdmin)->whereHas('intern');

        $ordered = $query->clone()->with('intern:id,name')->orderBy('created_at')->orderBy('id');

        return $this->box($query, $ordered, fn (AttendanceCorrection $correction): array => [
            'id' => $correction->id,
            'intern' => $this->person($correction->intern),
            'date' => $correction->date->toDateString(),
            'created_at' => $correction->created_at?->toIso8601String(),
        ]);
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function endingInternships(CarbonInterface $now): array
    {
        return $this->box(
            $this->endings->query($now),
            $this->endings->ordered($now),
            fn (InternProfile $profile): array => $this->endings->row($profile, $now),
        );
    }

    /**
     * @return Collection<int, int>
     */
    private function internIdsOn(string $date): Collection
    {
        return User::query()
            ->where('role', Role::Intern)
            ->where('is_active', true)
            ->whereHas('internProfile', fn (Builder $q) => $q
                ->whereDate('start_date', '<=', $date)
                ->whereDate('end_date', '>=', $date))
            ->pluck('id')
            ->toBase();
    }

    private function previousWorkingDay(string $today): string
    {
        $holidays = Holiday::query()
            ->whereDate('date', '<', $today)
            ->whereDate('date', '>=', Carbon::parse($today)->subDays(self::HOLIDAY_LOOKBACK_DAYS)->toDateString())
            ->get()
            ->map(fn (Holiday $holiday): string => $holiday->date->toDateString())
            ->all();

        $day = Carbon::parse($today)->subDay();

        while ($day->isWeekend() || in_array($day->toDateString(), $holidays, true)) {
            $day = $day->subDay();
        }

        return $day->toDateString();
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $count
     * @param  Builder<TModel>  $ordered
     * @param  callable(TModel): array<string, mixed>  $row
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function box(Builder $count, Builder $ordered, callable $row): array
    {
        $total = $count->count();

        if ($total === 0) {
            return ['total' => 0, 'items' => []];
        }

        return ['total' => $total, 'items' => array_values($ordered->limit(self::LIST_LIMIT)->get()->map($row)->all())];
    }

    /**
     * @return array{id: int, name: string, short_name: string}
     */
    private function person(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'short_name' => $user->shortName()];
    }
}
