<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\InternProfile;
use App\Models\LeaveRequest;
use App\Models\MentorHistory;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

class MentorInterns
{
    public const CURRENT = 'current';

    public const FORMER = 'former';

    public const FILTERS = ['active', 'inactive', 'former', 'all'];

    public function __construct(
        private AccountAccess $access,
        private AttendanceCalendar $calendar,
        private AttendanceHistory $history,
        private WorkSchedules $schedules,
        private LeaveQuotas $quotas,
        private SystemSettings $settings,
    ) {}

    public function relation(User $mentor, User $intern): ?string
    {
        if (! $intern->hasRole(Role::Intern)) {
            return null;
        }

        if ($intern->internProfile?->mentor_id === $mentor->id) {
            return self::CURRENT;
        }

        $former = MentorHistory::query()
            ->ended()
            ->where('intern_id', $intern->id)
            ->where('mentor_id', $mentor->id)
            ->exists();

        return $former ? self::FORMER : null;
    }

    /**
     * @return array{interns: list<array<string, mixed>>, current_total: int, former_total: int}
     */
    public function list(User $mentor, string $filter, ?string $search, CarbonInterface $now): array
    {
        $current = $this->currentQuery($mentor)->with(['internProfile.airport', 'unit'])->orderBy('name')->get();
        $former = $this->formerQuery($mentor)->with(['internProfile.airport', 'unit'])->orderBy('name')->get();

        $interns = match ($filter) {
            'former' => $former,
            'all' => $current,
            default => $current->filter(fn (User $intern): bool => $this->isActive($intern, $now) === ($filter === 'active')),
        };

        if ($search !== null && $search !== '') {
            $needle = mb_strtolower($search);
            $interns = $interns->filter(fn (User $intern): bool => str_contains(mb_strtolower($intern->name), $needle));
        }

        $relation = $filter === 'former' ? self::FORMER : self::CURRENT;

        return [
            'interns' => array_values($interns->map(fn (User $intern): array => $this->row($intern, $relation, $now))->all()),
            'current_total' => $current->count(),
            'former_total' => $former->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function detail(User $intern, string $relation, CarbonInterface $now): array
    {
        $intern->loadMissing(['internProfile.mentor', 'internProfile.airport', 'unit']);
        $profile = $intern->internProfile;
        $currentMentor = $profile?->mentor;

        return [
            ...$this->identity($intern, $relation, $now),
            'email' => $intern->email,
            'phone' => $intern->phone,
            'current_mentor' => $currentMentor === null ? null : ['id' => $currentMentor->id, 'name' => $currentMentor->name],
            'leave_quota' => $this->quotas->summary($intern),
            'selectable_months' => $this->history->selectableMonths($intern, $now),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function leaves(User $intern, string $relation): array
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
                'can_open' => $relation === self::CURRENT,
            ])
            ->all());
    }

    /**
     * @return Builder<User>
     */
    private function currentQuery(User $mentor): Builder
    {
        return User::query()
            ->where('role', Role::Intern)
            ->whereHas('internProfile', fn (Builder $q) => $q->where('mentor_id', $mentor->id));
    }

    /**
     * @return Builder<User>
     */
    private function formerQuery(User $mentor): Builder
    {
        return User::query()
            ->where('role', Role::Intern)
            ->whereIn('id', MentorHistory::query()->ended()->where('mentor_id', $mentor->id)->select('intern_id'))
            ->whereDoesntHave('internProfile', fn (Builder $q) => $q->where('mentor_id', $mentor->id));
    }

    /**
     * @return array<string, mixed>
     */
    private function row(User $intern, string $relation, CarbonInterface $now): array
    {
        $active = $this->isActive($intern, $now);

        return [
            ...$this->identity($intern, $relation, $now),
            'today_state' => $active && $relation === self::CURRENT
                ? $this->calendar->today($intern, $now)['state']->value
                : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function identity(User $intern, string $relation, CarbonInterface $now): array
    {
        $profile = $intern->internProfile;
        $active = $this->isActive($intern, $now);

        return [
            'id' => $intern->id,
            'name' => $intern->name,
            'unit' => $intern->unit?->name,
            'airport' => $profile?->airport->name,
            'institution_type' => $profile?->institution_type?->value,
            'university' => $profile?->university,
            'major' => $profile?->major,
            'student_number' => $profile?->student_number,
            'start_date' => $profile?->start_date->toDateString(),
            'end_date' => $profile?->end_date->toDateString(),
            'is_active' => $active,
            'relation' => $relation,
            'ends_in_days' => $active ? $this->endsInDays($profile, $now) : null,
        ];
    }

    private function isActive(User $intern, CarbonInterface $now): bool
    {
        return $this->access->denialReason($intern, $now) === null;
    }

    private function endsInDays(?InternProfile $profile, CarbonInterface $now): ?int
    {
        if ($profile === null) {
            return null;
        }

        $days = (int) $now->copy()->startOfDay()->diffInDays($profile->end_date->copy()->startOfDay());

        return $days >= 0 && $days <= $this->settings->endReminderDays() ? $days : null;
    }
}
