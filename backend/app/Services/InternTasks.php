<?php

namespace App\Services;

use App\Enums\TaskStatus;
use App\Exceptions\ActionRejected;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskRead;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * Task dari sisi intern (docs/design-intern.md, Alur 8): daftar atau Kanban, detail, dan perpindahan status.
 * Pengumpulan hasil (Alur 9) dan komentar baru (Alur 10) ada di alur masing-masing.
 */
class InternTasks
{
    /**
     * Kolom Done menampilkan 30 hari terakhir secara default (10.2).
     */
    public const DONE_DAYS = 30;

    public const STALE = 'Status Task sudah berubah. Muat ulang.';

    /**
     * @param  array{status?: string|null, late?: bool, q?: string|null, sort?: string|null, include_older_done?: bool}  $filters
     * @return array{tasks: Collection<int, Task>, hidden_done: int}
     */
    public function list(User $intern, array $filters, CarbonInterface $now): array
    {
        $query = $this->query($intern)
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($filters['q'] ?? null, fn (Builder $q, string $search) => $q->whereRaw('LOWER(title) LIKE ?', ['%'.mb_strtolower($search).'%']));

        ($filters['sort'] ?? 'due') === 'newest'
            ? $query->latest()->latest('id')
            : $query->orderBy('due_at')->orderBy('id');

        $tasks = $query->get();

        if ($filters['late'] ?? false) {
            $tasks = $tasks->filter(fn (Task $task): bool => $task->isLate($now))->values();
        }

        $since = $now->copy()->subDays(self::DONE_DAYS);
        $isOldDone = fn (Task $task): bool => $task->status === TaskStatus::Done
            && $task->done_at !== null && $task->done_at->lt($since);
        $hidden = ($filters['include_older_done'] ?? false) ? 0 : $tasks->filter($isOldDone)->count();

        return [
            'tasks' => $hidden === 0 ? $tasks : $tasks->reject($isOldDone)->values(),
            'hidden_done' => $hidden,
        ];
    }

    /**
     * Detail dengan thread komentar. Membuka detail berarti membaca komentar, jadi indikator
     * komentar baru hilang setelah respons ini (12.1 langkah 3).
     *
     * @return array{task: Task, unread_ids: list<int>}
     */
    public function open(User $intern, Task $task, CarbonInterface $now): array
    {
        $task = $this->query($intern)->with(['comments' => fn ($q) => $q->with('author:id,name,role')->oldest()->oldest('id')])
            ->findOrFail($task->id);

        $lastRead = TaskRead::query()->where('task_id', $task->id)->where('user_id', $intern->id)->value('last_read_at');
        $unread = array_values($task->comments
            ->filter(fn (TaskComment $c): bool => $c->user_id !== $intern->id
                && ($lastRead === null || $c->created_at?->gt($lastRead)))
            ->map(fn (TaskComment $c): int => $c->id)
            ->all());

        TaskRead::query()->updateOrCreate(
            ['task_id' => $task->id, 'user_id' => $intern->id],
            ['last_read_at' => $now],
        );

        return ['task' => $task, 'unread_ids' => $unread];
    }

    /**
     * Perpindahan oleh intern (10.2): To Do ke In Progress, dan In Progress ke To Do jika belum pernah
     * dikumpulkan. In Progress ke In Review hanya lewat pengumpulan hasil. `$expected` adalah status
     * yang dilihat intern saat menyeret; jika sudah berubah, perpindahan ditolak.
     *
     * @throws ActionRejected
     */
    public function move(Task $task, TaskStatus $to, ?TaskStatus $expected): Task
    {
        $from = $task->status;

        if ($expected !== null && $expected !== $from) {
            throw new ActionRejected(self::STALE, 'stale');
        }

        if ($from === $to) {
            return $task;
        }

        [$message, $reason] = match (true) {
            $from === TaskStatus::InReview => ['Task sedang diperiksa mentor.', 'in_review_locked'],
            $from === TaskStatus::Done => ['Task sudah selesai dan terkunci.', 'done_locked'],
            $to === TaskStatus::Done => ['Hanya mentor yang bisa menandai Done lewat Accept.', 'mentor_only'],
            $to === TaskStatus::InReview && $from === TaskStatus::Todo => ['Mulai kerjakan Task dulu sebelum mengumpulkan.', 'not_started'],
            $to === TaskStatus::InReview => ['Kumpulkan hasil untuk memindahkan Task ke In Review.', 'submission_required'],
            $to === TaskStatus::Todo && $task->ever_submitted => ['Task yang pernah dikumpulkan tidak bisa kembali ke To Do.', 'ever_submitted'],
            default => [null, null],
        };

        if ($message !== null) {
            throw new ActionRejected($message, (string) $reason);
        }

        // Update bersyarat: jika mentor mengubah status di saat yang sama, perpindahan ini batal.
        $updated = Task::query()->whereKey($task->id)->where('status', $from)->update(['status' => $to]);

        if ($updated === 0) {
            throw new ActionRejected(self::STALE, 'stale');
        }

        return $task->refresh();
    }

    /**
     * Task milik intern beserta mentor dan jumlah komentar orang lain yang belum dibaca.
     *
     * @return Builder<Task>
     */
    private function query(User $intern): Builder
    {
        return $intern->assignedTasks()
            ->getQuery()
            ->with('mentor:id,name')
            ->withCount(['comments as unread_comments_count' => fn (Builder $q) => $q
                ->where(fn (Builder $q) => $q->whereNull('user_id')->orWhere('user_id', '!=', $intern->id))
                ->whereNotExists(fn (QueryBuilder $read) => $read
                    ->selectRaw('1')
                    ->from('task_reads')
                    ->whereColumn('task_reads.task_id', 'task_comments.task_id')
                    ->where('task_reads.user_id', $intern->id)
                    ->whereColumn('task_reads.last_read_at', '>=', 'task_comments.created_at')),
            ]);
    }
}
