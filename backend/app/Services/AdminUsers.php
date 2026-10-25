<?php

namespace App\Services;

use App\Enums\CorrectionStatus;
use App\Enums\RequestStatus;
use App\Enums\Role;
use App\Models\AttendanceCorrection;
use App\Models\LeaveRequest;
use App\Models\MentorHistory;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class AdminUsers
{
    public const PER_PAGE = 10;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    public const STATUS_ALL = 'all';

    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_INACTIVE, self::STATUS_ALL];

    public function __construct(private AccountAccess $access, private WorkSchedules $schedules, private LeaveQuotas $quotas) {}

    /**
     * @param  array{q?: string|null, role?: string|null, status?: string|null}  $filters
     * @return LengthAwarePaginator<int, User>
     */
    public function list(array $filters, CarbonInterface $now): LengthAwarePaginator
    {
        $today = $now->toDateString();

        return User::query()
            ->with(['unit:id,name', 'internProfile.mentor:id,name', 'internProfile.airport:id,name'])
            ->when($filters['q'] ?? null, function (Builder $q, string $search): void {
                $needle = '%'.mb_strtolower($search).'%';
                $q->where(fn (Builder $q) => $q->whereRaw('LOWER(name) LIKE ?', [$needle])->orWhere('email', 'like', $needle));
            })
            ->when($filters['role'] ?? null, fn (Builder $q, string $role) => $q->where('role', $role))
            ->when(
                $filters['status'] ?? self::STATUS_ACTIVE,
                fn (Builder $q, string $status) => match ($status) {
                    self::STATUS_ACTIVE => $this->whereActive($q, $today),
                    self::STATUS_INACTIVE => $q->whereNot(fn (Builder $q) => $this->whereActive($q, $today)),
                    default => $q,
                },
            )
            ->orderBy('name')
            ->orderBy('id')
            ->paginate(self::PER_PAGE);
    }

    /**
     * @return Collection<int, User>
     */
    public function activeMentors(): Collection
    {
        return User::query()
            ->where('role', Role::Mentor)
            ->where('is_active', true)
            ->with('unit:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'unit_id']);
    }

    /**
     * @return array<string, mixed>
     */
    public function detail(User $user, CarbonInterface $now): array
    {
        return match ($user->role) {
            Role::Intern => ['former_mentors' => $this->formerMentors($user), 'leave_quota' => $this->quotas->summary($user)],
            Role::Mentor => ['interns' => User::query()
                ->with('internProfile')
                ->whereHas('internProfile', fn (Builder $q) => $q->where('mentor_id', $user->id))
                ->orderBy('name')
                ->get()
                ->map(fn (User $intern): array => [
                    'id' => $intern->id,
                    'name' => $intern->name,
                    'status' => $this->access->status($intern, $now)->value,
                ])
                ->values()
                ->all()],
            Role::Admin => [],
        };
    }

    /**
     * @return array{current_mentor: array{id: int, name: string}|null, pending_corrections: int, pending_leaves: int}
     */
    public function mentorChangeImpact(User $intern): array
    {
        $mentor = $intern->internProfile?->mentor;

        return [
            'current_mentor' => $mentor === null ? null : ['id' => $mentor->id, 'name' => $mentor->name],
            'pending_corrections' => $intern->attendanceCorrections()->where('status', CorrectionStatus::PendingMentor)->count(),
            'pending_leaves' => $intern->leaveRequests()->where('status', RequestStatus::Pending)->count(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function leaves(User $intern): array
    {
        return array_values($intern->leaveRequests()
            ->with('decider:id,name,role')
            ->latest()
            ->latest('id')
            ->get()
            ->map(fn (LeaveRequest $leave): array => [
                'id' => $leave->id,
                'type' => $leave->type->value,
                'start_date' => $leave->start_date->toDateString(),
                'end_date' => $leave->end_date->toDateString(),
                'working_days' => $this->schedules->workingDays($intern, $leave->start_date->toDateString(), $leave->end_date->toDateString()),
                'status' => $leave->status->value,
                'evidence_url' => $leave->evidence_url,
                'submitted_at' => $leave->created_at?->toIso8601String(),
                'decided_by' => $leave->decider === null ? null : [
                    'name' => $leave->decider->name,
                    'role' => $leave->decider->role->value,
                ],
                'decision_note' => $leave->decision_note,
                'decided_at' => $leave->decided_at?->toIso8601String(),
            ])
            ->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function corrections(User $intern): array
    {
        return array_values($intern->attendanceCorrections()
            ->with(['mentor:id,name', 'admin:id,name'])
            ->latest()
            ->latest('id')
            ->get()
            ->map(fn (AttendanceCorrection $correction): array => [
                'id' => $correction->id,
                'date' => $correction->date->toDateString(),
                'submitted_at' => $correction->created_at?->toIso8601String(),
                'status' => $correction->status->value,
                'recorded_status' => $correction->recorded_status->value,
                'recorded_missed_clock_out' => $correction->recorded_missed_clock_out,
                'reason' => $correction->reason,
                'mentor' => $correction->mentor?->name,
                'mentor_note' => $correction->mentor_note,
                'mentor_decided_at' => $correction->mentor_decided_at?->toIso8601String(),
                'admin' => $correction->admin?->name,
                'admin_note' => $correction->admin_note,
                'admin_decided_at' => $correction->admin_decided_at?->toIso8601String(),
            ])
            ->all());
    }

    /**
     * @param  Builder<User>  $query
     * @return Builder<User>
     */
    private function whereActive(Builder $query, string $today): Builder
    {
        return $query->where('is_active', true)->where(fn (Builder $q) => $q
            ->where('role', '!=', Role::Intern)
            ->orWhereHas('internProfile', fn (Builder $q) => $q->whereDate('end_date', '>=', $today)));
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    private function formerMentors(User $intern): array
    {
        $ids = MentorHistory::query()
            ->ended()
            ->where('intern_id', $intern->id)
            ->whereNotNull('mentor_id')
            ->where('mentor_id', '!=', $intern->internProfile?->mentor_id)
            ->orderBy('ended_at')
            ->orderBy('id')
            ->pluck('mentor_id')
            ->unique();

        $names = User::withTrashed()->whereIn('id', $ids)->pluck('name', 'id');

        return array_values($ids
            ->filter(fn (int $id): bool => $names->has($id))
            ->map(fn (int $id): array => ['id' => $id, 'name' => (string) $names->get($id)])
            ->all());
    }
}
