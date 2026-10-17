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

/**
 * Isi Dashboard Mentor (docs/design-mentor.md, Alur 2).
 *
 * Intern bimbingan = intern yang `intern_profiles.mentor_id`-nya mentor ini (mentor saat ini).
 * Task mengikuti `tasks.mentor_id`, sama dengan penerima notifikasi pengumpulan Task.
 * Izin mengikuti mentor saat ini, karena izin pending ikut pindah saat ganti mentor (13.1).
 */
class MentorDashboard
{
    /** Tiap kotak Perlu Tindakan menampilkan maksimal 5 baris (4.2). */
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
            // `name` null berarti akhir pekan; frontend menulis "akhir pekan".
            'holiday' => $isHoliday ? ['name' => $holidayName] : null,
            // 0 berarti "Belum ada intern bimbingan. Hubungi admin untuk penugasan."
            'interns_total' => $interns->count(),
            // Kartu hari ini disembunyikan pada hari libur (4.3).
            'today' => $isHoliday ? null : $this->today($interns, $now),
            'review_tasks' => $this->reviewTasks($mentor, $now),
            'pending_leaves' => $this->pendingLeaves($mentor, $now),
            'unread_comments' => $this->unreadComments($mentor),
            'late_tasks' => $this->lateTasks($mentor, $now),
            'announcements' => $this->announcements(),
        ];
    }

    /**
     * Kartu "Intern saya hari ini": hanya intern aktif dan dalam periode magang.
     * Yang belum clock in disebut Belum Clock In, bukan Tidak Hadir, karena status final baru setelah 23:59.
     *
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
     * Task In Review, dari yang paling lama menunggu.
     *
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
     * Izin Pending intern bimbingan, dari yang paling lama pending.
     *
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
            // Lama pending dalam jam, misalnya "26 jam", dan tanda "!" lebih dari 24 jam.
            'pending_hours' => $leave->pendingHours($now),
            'is_overdue' => $leave->isOverduePending($now),
        ]);
    }

    /**
     * Task yang punya komentar intern (atau orang lain selain mentor ini) yang belum dibaca mentor.
     * Dari komentar belum dibaca yang paling lama. Membuka detail Task sebagai mentor akan menghapusnya dari daftar.
     *
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
            // Nama sama dengan kartu Task intern dan mentor.
            'unread_comments' => (int) $task->unread_comments_count,
        ]);
    }

    /**
     * Task yang lewat tenggat dan belum Done, aturan sama dengan Task::isLate().
     * Task In Review dinilai dari waktu pengumpulan terakhir. Tenggat paling lama lewat lebih dulu.
     *
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
            // "Lewat 2 hari"; untuk In Review dihitung sampai waktu pengumpulan.
            'late_label' => $task->lateLabel($task->status === TaskStatus::InReview && $task->submitted_at !== null ? $task->submitted_at : $now),
        ]);
    }

    /**
     * Task milik mentor ini yang internnya belum dihapus.
     *
     * @return Builder<Task>
     */
    private function tasksOf(User $mentor): Builder
    {
        return Task::query()->where('mentor_id', $mentor->id)->whereHas('intern');
    }

    /**
     * Satu kotak Perlu Tindakan: jumlah seluruhnya dan maksimal LIST_LIMIT baris.
     *
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
     * Pengumuman terbaru untuk role Mentor.
     *
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
