<?php

namespace App\Services;

use App\Enums\RequestStatus;
use App\Enums\Role;
use App\Enums\TaskStatus;
use App\Models\AttendanceCorrection;
use App\Models\LeaveRequest;
use App\Models\MentorHistory;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Halaman Pengguna, sisi baca (docs/design-admin.md 4.1, 4.3, 4.4), termasuk tab Izin dan Koreksi
 * di detail intern. Tab Absensi ada di AttendanceHistory, tab Warning di AdminWarnings.
 * Perubahan akun ada di AccountManagement.
 */
class AdminUsers
{
    public const PER_PAGE = 10;

    /**
     * Filter Status: default Aktif (4.1). Aktif termasuk intern yang belum mulai: akunnya tidak
     * dinonaktifkan dan akan bisa dipakai, jadi tidak masuk Nonaktif.
     */
    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    public const STATUS_ALL = 'all';

    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_INACTIVE, self::STATUS_ALL];

    public function __construct(private AccountAccess $access, private AttendanceCalendar $calendar) {}

    /**
     * @param  array{q?: string|null, role?: string|null, status?: string|null}  $filters
     * @return LengthAwarePaginator<int, User>
     */
    public function list(array $filters, CarbonInterface $now): LengthAwarePaginator
    {
        $today = $now->toDateString();

        return User::query()
            ->with('internProfile.mentor:id,name')
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
     * Mentor aktif untuk pilihan di Tambah Akun dan Ganti Mentor, urut nama.
     *
     * @return Collection<int, User>
     */
    public function activeMentors(): Collection
    {
        return User::query()
            ->where('role', Role::Mentor)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'title']);
    }

    /**
     * Data tambahan tab Profil: mentor sebelumnya (intern) atau intern bimbingan saat ini (mentor).
     *
     * @return array<string, mixed>
     */
    public function detail(User $user, CarbonInterface $now): array
    {
        return match ($user->role) {
            Role::Intern => ['former_mentors' => $this->formerMentors($user)],
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
     * Ringkasan dampak di dialog Ganti Mentor (4.4): Task yang belum Done beserta komentarnya, dan izin Pending.
     *
     * @return array{current_mentor: array{id: int, name: string}|null, active_tasks: int, comments: int, pending_leaves: int}
     */
    public function mentorChangeImpact(User $intern): array
    {
        $mentor = $intern->internProfile?->mentor;
        $activeTasks = Task::query()->where('intern_id', $intern->id)->where('status', '!=', TaskStatus::Done);

        return [
            'current_mentor' => $mentor === null ? null : ['id' => $mentor->id, 'name' => $mentor->name],
            'active_tasks' => $activeTasks->count(),
            'comments' => TaskComment::query()->whereIn('task_id', $activeTasks->select('id'))->count(),
            'pending_leaves' => $intern->leaveRequests()->where('status', RequestStatus::Pending)->count(),
        ];
    }

    /**
     * Tab Izin di detail intern: semua pengajuan, terbaru lebih dulu, dengan pemroses dan catatannya.
     *
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
                'working_days' => $this->calendar->workingDays($leave->start_date->toDateString(), $leave->end_date->toDateString()),
                'status' => $leave->status->value,
                'has_evidence' => $leave->evidence_path !== null,
                'submitted_at' => $leave->created_at?->toIso8601String(),
                // "Diproses oleh": nama dan role (mentor atau admin).
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
     * Tab Koreksi di detail intern: semua permintaan, pengajuan terbaru lebih dulu.
     *
     * @return list<array<string, mixed>>
     */
    public function corrections(User $intern): array
    {
        $time = fn (?string $value): ?string => $value === null ? null : substr($value, 0, 5);

        return array_values($intern->attendanceCorrections()
            ->with('decider:id,name')
            ->latest()
            ->latest('id')
            ->get()
            ->map(fn (AttendanceCorrection $correction): array => [
                'id' => $correction->id,
                'date' => $correction->date->toDateString(),
                'submitted_at' => $correction->created_at?->toIso8601String(),
                'status' => $correction->status->value,
                'recorded' => ['clock_in' => $time($correction->recorded_clock_in), 'clock_out' => $time($correction->recorded_clock_out)],
                'requested' => ['clock_in' => $time($correction->requested_clock_in), 'clock_out' => $time($correction->requested_clock_out)],
                'reason' => $correction->reason,
                'has_evidence' => $correction->evidence_path !== null,
                // Kolom "Catatan admin".
                'decision_note' => $correction->decision_note,
                'decided_by' => $correction->decider?->name,
                'decided_at' => $correction->decided_at?->toIso8601String(),
            ])
            ->all());
    }

    /**
     * Akun aktif: belum dinonaktifkan admin dan, untuk intern, belum lewat tanggal selesai magang.
     *
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
     * Mentor yang pernah membimbing intern ini, selain mentor saat ini, dari yang paling lama.
     *
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
