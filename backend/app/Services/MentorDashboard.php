<?php

namespace App\Services;

use App\Enums\RequestStatus;
use App\Enums\TaskStatus;
use App\Models\Announcement;
use App\Models\Attendance;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class MentorDashboard
{
    public const LIST_LIMIT = 5;

    public const ANNOUNCEMENT_LIMIT = 3;

    public function __construct(private AccountAccess $access) {}

    /**
     * @return array<string, mixed>
     */
    public function for(User $mentor, CarbonInterface $now): array
    {
        $interns = User::query()
            ->with('internProfile')
            ->whereHas('internProfile', fn (Builder $q) => $q->where('mentor_id', $mentor->id))
            ->orderBy('name')
            ->get();

        $date = $now->toDateString();
        $holidayName = Holiday::query()->whereDate('date', $date)->value('name');
        $isHoliday = $holidayName !== null || $now->isWeekend();

        return [
            'date' => $date,
            'holiday' => $isHoliday ? ['name' => $holidayName] : null,
            'interns_total' => $interns->count(),
            'today' => $isHoliday ? null : $this->today($interns, $now),
            'review_tasks' => $this->reviewTasks($mentor, $now),
            'pending_leaves' => $this->pendingLeaves($mentor, $now),
            'unread_comments' => $this->unreadComments($mentor),
            'late_tasks' => $this->lateTasks($mentor, $now),
            'announcements' => $this->announcements(),
        ];
    }

    /**
     * @param  Collection<int, User>  $interns
     * @return array{interns: int, clocked_in: int, on_leave: int, not_clocked_in: int}
     */
    private function today(Collection $interns, CarbonInterface $now): array
    {
        $ids = $interns
            ->filter(fn (User $intern): bool => $this->access->denialReason($intern, $now) === null)
            ->pluck('id');

        $date = $now->toDateString();

        $clockedIn = Attendance::query()
            ->whereIn('intern_id', $ids)
            ->whereDate('date', $date)
            ->pluck('intern_id')
            ->unique();

        // Hari yang sudah clock in tetap dihitung Sudah Clock In walau ada izin disetujui.
        $onLeave = LeaveRequest::query()
            ->whereIn('intern_id', $ids->diff($clockedIn))
            ->approvedBetween($date, $date)
            ->pluck('intern_id')
            ->unique();

        return [
            'interns' => $ids->count(),
            'clocked_in' => $clockedIn->count(),
            'on_leave' => $onLeave->count(),
            'not_clocked_in' => $ids->count() - $clockedIn->count() - $onLeave->count(),
        ];
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function reviewTasks(User $mentor, CarbonInterface $now): array
    {
        $query = $this->tasksOf($mentor)->where('status', TaskStatus::InReview);

        return $this->box($query, $query->clone()->orderBy('submitted_at')->orderBy('id'), fn (Task $task): array => [
            ...$this->taskRow($task),
            'submitted_at' => $task->submitted_at?->toIso8601String(),
            'is_late' => $task->isLate($now),
        ]);
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function pendingLeaves(User $mentor, CarbonInterface $now): array
    {
        $query = LeaveRequest::query()
            ->where('status', RequestStatus::Pending)
            ->whereHas('intern.internProfile', fn (Builder $q) => $q->where('mentor_id', $mentor->id));

        $ordered = $query->clone()->with('intern:id,name')->orderBy('created_at')->orderBy('id');

        return $this->box($query, $ordered, fn (LeaveRequest $leave): array => [
            'id' => $leave->id,
            'intern' => $this->person($leave->intern),
            'type' => $leave->type->value,
            'start_date' => $leave->start_date->toDateString(),
            'end_date' => $leave->end_date->toDateString(),
            'created_at' => $leave->created_at?->toIso8601String(),
            'pending_hours' => $leave->pendingHours($now),
            'is_overdue' => $leave->isOverduePending($now),
        ]);
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function unreadComments(User $mentor): array
    {
        $unread = fn (Builder $q) => $q->unreadFor($mentor->id);

        $query = $this->tasksOf($mentor)->whereHas('comments', $unread);

        $ordered = $query->clone()
            ->withCount(['comments as unread_comments_count' => $unread])
            ->withMin(['comments as oldest_unread_at' => $unread], 'created_at')
            ->orderBy('oldest_unread_at')
            ->orderBy('id');

        return $this->box($query, $ordered, fn (Task $task): array => [
            ...$this->taskRow($task),
            'status' => $task->status->value,
            'unread_comments' => (int) $task->unread_comments_count,
        ]);
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function lateTasks(User $mentor, CarbonInterface $now): array
    {
        $query = $this->tasksOf($mentor)->where(fn (Builder $q) => $q
            ->where(fn (Builder $q) => $q
                ->whereIn('status', [TaskStatus::Todo, TaskStatus::InProgress])
                ->where('due_at', '<', $now))
            ->orWhere(fn (Builder $q) => $q
                ->where('status', TaskStatus::InReview)
                ->where(fn (Builder $q) => $q
                    ->whereColumn('submitted_at', '>', 'due_at')
                    ->orWhere(fn (Builder $q) => $q->whereNull('submitted_at')->where('due_at', '<', $now)))));

        return $this->box($query, $query->clone()->orderBy('due_at')->orderBy('id'), fn (Task $task): array => [
            ...$this->taskRow($task),
            'status' => $task->status->value,
            'due_at' => $task->due_at->toIso8601String(),
            'late_label' => $task->lateLabel($task->status === TaskStatus::InReview && $task->submitted_at !== null ? $task->submitted_at : $now),
        ]);
    }

    /**
     * @return Builder<Task>
     */
    private function tasksOf(User $mentor): Builder
    {
        return Task::query()->where('mentor_id', $mentor->id)->whereHas('intern');
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

        $items = $ordered->with('intern:id,name')->limit(self::LIST_LIMIT)->get()->map($row)->values()->all();

        return ['total' => $total, 'items' => $items];
    }

    /**
     * @return array<string, mixed>
     */
    private function taskRow(Task $task): array
    {
        return [
            'id' => $task->id,
            'code' => $task->code,
            'title' => $task->title,
            'intern' => $this->person($task->intern),
        ];
    }

    /**
     * @return array{id: int, name: string, short_name: string}
     */
    private function person(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'short_name' => $user->shortName()];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function announcements(): array
    {
        return Announcement::query()
            ->with('author:id,name')
            ->where('for_mentor', true)
            ->latest()
            ->latest('id')
            ->limit(self::ANNOUNCEMENT_LIMIT)
            ->get()
            ->map(fn (Announcement $a): array => [
                'id' => $a->id,
                'title' => $a->title,
                'body' => $a->body,
                'author_name' => $a->author?->name,
                'created_at' => $a->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();
    }
}
