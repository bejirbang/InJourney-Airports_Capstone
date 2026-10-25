<?php

namespace App\Services;

use App\Enums\TaskStatus;
use App\Exceptions\ActionRejected;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class InternTasks
{
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

        return Task::withoutOldDone($tasks, $filters['include_older_done'] ?? false, $now);
    }

    /**
     * @return array{task: Task, unread_ids: list<int>}
     */
    public function open(User $intern, Task $task, CarbonInterface $now): array
    {
        $task = $this->query($intern)->with(['comments' => fn ($q) => $q->with('author:id,name,role')->oldest()->oldest('id')])
            ->findOrFail($task->id);

        return ['task' => $task, 'unread_ids' => $task->markCommentsRead($intern, $now)];
    }

    /**
     * `$expected` adalah status yang dilihat intern saat menyeret; jika sudah berubah, perpindahan ditolak.
     *
     * @throws ActionRejected
     */
    public function move(Task $task, TaskStatus $to, ?TaskStatus $expected): Task
    {
        $from = $task->status;

        if ($expected !== null && $expected !== $from) {
            throw new ActionRejected(Task::STALE, 'stale');
        }

        if ($from === $to) {
            return $task;
        }

        [$message, $reason] = match (true) {
            $from === TaskStatus::InReview => ['Task sedang diperiksa mentor.', 'in_review_locked'],
            $from === TaskStatus::Done => [Task::DONE_LOCKED, 'done_locked'],
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
            throw new ActionRejected(Task::STALE, 'stale');
        }

        return $task->refresh();
    }

    /**
     * @return Builder<Task>
     */
    private function query(User $intern): Builder
    {
        return $intern->assignedTasks()
            ->getQuery()
            ->with('mentor:id,name')
            ->withCount(['comments as unread_comments_count' => fn (Builder $q) => $q->unreadFor($intern->id)]);
    }
}
