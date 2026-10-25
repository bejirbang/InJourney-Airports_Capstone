<?php

namespace App\Services;

use App\Enums\RequestStatus;
use App\Models\Announcement;
use App\Models\Attendance;
use App\Models\Holiday;
use App\Models\LeaveRequest;
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
            'pending_leaves' => $this->pendingLeaves($mentor, $now),
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

        $items = array_values($ordered->with('intern:id,name')->limit(self::LIST_LIMIT)->get()->map($row)->all());

        return ['total' => $total, 'items' => $items];
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
