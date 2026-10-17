<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\InternProfile;
use App\Models\LeaveRequest;
use App\Models\MentorHistory;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * Halaman Intern Saya (docs/design-mentor.md, Alur 3). Semua hanya baca.
 *
 * Hubungan mentor dengan intern:
 * - `current`: mentor saat ini (`intern_profiles.mentor_id`), termasuk intern yang sudah nonaktif.
 * - `former`: pernah dibimbing (`mentor_histories` yang sudah berakhir) dan kini dibimbing mentor lain.
 *   Hanya baca, tanpa tombol Buka ke Task dan Izin (13.1, 17.1 no. 11).
 * Intern lain tidak bisa dilihat (16).
 */
class MentorInterns
{
    public const CURRENT = 'current';

    public const FORMER = 'former';

    /** Tanda "berakhir N hari lagi" muncul sejak 7 hari sebelum tanggal selesai (5.1). */
    public const ENDING_SOON_DAYS = 7;

    public const FILTERS = ['active', 'inactive', 'former', 'all'];

    public function __construct(
        private AccountAccess $access,
        private AttendanceCalendar $calendar,
        private AttendanceHistory $history,
    ) {}

    /**
     * `current`, `former`, atau null jika mentor tidak boleh melihat intern ini.
     */
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
     * Daftar Intern Saya. Filter: `active` (default), `inactive`, `former` (pernah dibimbing),
     * `all` (semua intern bimbingan saat ini, aktif dan nonaktif). Urut nama.
     *
     * @return array{interns: list<array<string, mixed>>, current_total: int, former_total: int}
     */
    public function list(User $mentor, string $filter, ?string $search, CarbonInterface $now): array
    {
        $current = $this->currentQuery($mentor)->with('internProfile')->orderBy('name')->get();
        $former = $this->formerQuery($mentor)->with('internProfile')->orderBy('name')->get();

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
            'interns' => $interns->map(fn (User $intern): array => $this->row($intern, $relation, $now))->values()->all(),
            'current_total' => $current->count(),
            'former_total' => $former->count(),
        ];
    }

    /**
     * Kepala halaman detail intern: data akun, periode, dan hubungan dengan mentor.
     *
     * @return array<string, mixed>
     */
    public function detail(User $intern, string $relation, CarbonInterface $now): array
    {
        $intern->loadMissing('internProfile.mentor');
        $profile = $intern->internProfile;
        $currentMentor = $profile?->mentor;

        return [
            ...$this->identity($intern, $relation, $now),
            'email' => $intern->email,
            'phone' => $intern->phone,
            // Banner mentor lama: "Intern ini sekarang dibimbing [nama]. Anda hanya dapat melihat riwayat."
            'current_mentor' => $currentMentor === null ? null : ['id' => $currentMentor->id, 'name' => $currentMentor->name],
            // Pilihan bulan untuk tab Rekap Absensi dan Daily Report.
            'selectable_months' => $this->history->selectableMonths($intern, $now),
        ];
    }

    /**
     * Tab Task. Mentor saat ini melihat semua Task intern; mentor lama hanya Task yang ia buat.
     * Tenggat terbaru lebih dulu.
     *
     * @return list<array<string, mixed>>
     */
    public function tasks(User $mentor, User $intern, string $relation, CarbonInterface $now): array
    {
        return $intern->assignedTasks()
            ->when($relation === self::FORMER, fn (Builder $q) => $q->where('mentor_id', $mentor->id))
            ->orderByDesc('due_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Task $task): array => [
                'id' => $task->id,
                'code' => $task->code,
                'title' => $task->title,
                'status' => $task->status->value,
                'due_at' => $task->due_at->toIso8601String(),
                'is_late' => $task->isLate($now),
                // Tombol Buka ke detail Task hanya untuk mentor saat ini.
                'can_open' => $relation === self::CURRENT,
            ])
            ->values()
            ->all();
    }

    /**
     * Tab Izin: riwayat izin intern, pengajuan terbaru lebih dulu.
     *
     * @return list<array<string, mixed>>
     */
    public function leaves(User $intern, string $relation): array
    {
        return $intern->leaveRequests()
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
                // "Diproses oleh": role admin ditampilkan "admin".
                'decided_by' => $leave->decider === null ? null : [
                    'name' => $leave->decider->name,
                    'role' => $leave->decider->role->value,
                ],
                // Tombol Buka (Pending) atau Lihat ke halaman Izin hanya untuk mentor saat ini.
                'can_open' => $relation === self::CURRENT,
            ])
            ->values()
            ->all();
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
     * Pernah dibimbing mentor ini, tetapi sekarang dibimbing mentor lain.
     *
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
            // Kolom Hari ini: hanya intern aktif yang sedang dibimbing; selain itu "-".
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
            'title' => $intern->title,
            'photo_url' => $intern->photoUrl(),
            'start_date' => $profile?->start_date->toDateString(),
            'end_date' => $profile?->end_date->toDateString(),
            // Belum mulai, sudah selesai, atau dinonaktifkan admin dihitung Nonaktif.
            'is_active' => $active,
            'relation' => $relation,
            // Tanda "! berakhir N hari lagi" (0 = hari ini hari terakhir). Null jika tidak perlu ditandai.
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

        return $days >= 0 && $days <= self::ENDING_SOON_DAYS ? $days : null;
    }
}
