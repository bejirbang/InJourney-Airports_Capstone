<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Enums\TaskStatus;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

class MentorPerformance
{
    public const MIN_KPI_DAYS = 5;

    public function __construct(private AttendanceCalendar $calendar, private AccountAccess $access) {}

    /**
     * @return array<string, mixed>
     */
    public function month(User $mentor, string $month, ?int $internId, CarbonInterface $now): array
    {
        $mentees = User::query()
            ->with('internProfile')
            ->whereHas('internProfile', fn (Builder $q) => $q->where('mentor_id', $mentor->id))
            ->orderBy('name')
            ->get();

        [$from, $to] = AttendanceCalendar::monthRange($month);

        $rows = $mentees
            ->when($internId !== null, fn ($c) => $c->where('id', $internId))
            ->map(fn (User $intern): array => $this->internRow($intern, $month, $from, $to, $now))
            ->filter(fn (array $row): bool => $row['recap']['working_days'] > 0 || $row['kpi']['tasks_due'] > 0)
            ->values();

        $enough = $rows->where('kpi.enough_data', true);
        $average = function (string $key) use ($enough): ?int {
            $values = $enough->pluck("kpi.{$key}")->filter(fn ($v): bool => $v !== null);

            return $values->isEmpty() ? null : (int) round($values->avg());
        };

        $firstMonth = $mentees->min(fn (User $i): ?string => $i->internProfile?->start_date->format('Y-m'));

        return [
            'month' => $month,
            'selectable_months' => $firstMonth === null ? null : ['first' => $firstMonth, 'last' => $now->format('Y-m')],
            'interns_total' => $mentees->count(),
            'summary' => [
                'attendance_rate' => $average('attendance_rate'),
                'on_time_rate' => $average('on_time_rate'),
                'daily_report_rate' => $average('daily_report_rate'),
            ],
            'interns' => $rows->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function internRow(User $intern, string $month, string $from, string $to, CarbonInterface $now): array
    {
        $days = $this->calendar->days($intern, $from, $to, $now);
        $recap = $this->calendar->recap($days, $month, $now);
        $today = $now->toDateString();

        $reports = count(array_filter(
            $days,
            fn (array $day, string $date): bool => $date < $today
                && $day['status'] === AttendanceStatus::Present
                && $day['attendance']?->dailyReport !== null,
            ARRAY_FILTER_USE_BOTH,
        ));

        $tasks = $intern->assignedTasks()->get();
        $due = $tasks->filter(fn (Task $task): bool => $task->due_at->format('Y-m') === $month);
        $onTime = $due->filter(fn (Task $task): bool => $task->status === TaskStatus::Done
            && $task->submitted_at !== null
            && $task->submitted_at->lte($task->due_at))->count();

        $present = $recap['present'];

        return [
            'intern' => ['id' => $intern->id, 'name' => $intern->name, 'short_name' => $intern->shortName()],
            'is_active' => $this->access->denialReason($intern, $now) === null,
            'recap' => [
                'present' => $present,
                'leave' => $recap['leave'],
                'absent' => $recap['absent'],
                'missed_clock_out' => $recap['missed_clock_out'],
                'working_days' => $recap['working_days'],
            ],
            'kpi' => [
                'enough_data' => $recap['working_days'] >= self::MIN_KPI_DAYS,
                'attendance_rate' => self::percent($present, $recap['working_days'] - $recap['leave']),
                'on_time_rate' => self::percent($onTime, $due->count()),
                'tasks_on_time' => $onTime,
                'tasks_due' => $due->count(),
                'daily_report_rate' => self::percent($reports, $present),
                'revisions' => (int) $due->sum('revision_count'),
                'late_tasks_now' => $tasks->filter(fn (Task $task): bool => $task->isLate($now))->count(),
            ],
        ];
    }

    private static function percent(int $numerator, int $denominator): ?int
    {
        return $denominator > 0 ? (int) round($numerator / $denominator * 100) : null;
    }
}
