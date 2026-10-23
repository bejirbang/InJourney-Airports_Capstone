<?php

namespace App\Services;

use App\Enums\TaskStatus;
use App\Exceptions\ActionRejected;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskRead;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class MentorTaskReview
{
    public const RESUBMITTED = 'Hasil baru dikumpulkan. Muat ulang.';

    public const INACTIVE_INTERN = 'Intern sudah nonaktif dan tidak dapat menindaklanjuti revisi.';

    public function __construct(private AccountAccess $access, private Notifier $notifier) {}

    /**
     * @return array{task: Task, unread_ids: list<int>}
     */
    public function open(User $mentor, Task $task, CarbonInterface $now): array
    {
        $task->load([
            'intern.internProfile',
            'comments' => fn ($q) => $q->with('author:id,name,role')->oldest()->oldest('id'),
        ])->loadCount('comments');

        return ['task' => $task, 'unread_ids' => $task->markCommentsRead($mentor, $now)];
    }

    /**
     * @throws ActionRejected
     */
    public function comment(User $mentor, Task $task, string $body, CarbonInterface $now): TaskComment
    {
        $comment = DB::transaction(function () use ($mentor, $task, $body, $now): TaskComment {
            $task = Task::query()->lockForUpdate()->findOrFail($task->id);

            if ($task->status === TaskStatus::Done) {
                throw new ActionRejected(Task::DONE_LOCKED, 'done_locked');
            }

            $comment = $this->addComment($mentor, $task, $body, false, $now);

            return $comment->setRelation('task', $task);
        });

        $this->notifier->send(
            [$comment->task->intern_id],
            "{$mentor->name} berkomentar di '{$comment->task->title}'.",
            '/task',
            ['open' => $comment->task->id, 'to' => 'comments'],
        );

        return $comment->load('author:id,name,role');
    }

    /**
     * `$seenSubmittedAt` adalah waktu kumpul yang dilihat mentor; jika intern sudah mengganti hasil, ditolak.
     *
     * @throws ActionRejected
     */
    public function accept(User $mentor, Task $task, ?string $comment, ?string $seenSubmittedAt, CarbonInterface $now): Task
    {
        $task = DB::transaction(function () use ($mentor, $task, $comment, $seenSubmittedAt, $now): Task {
            $task = $this->lockInReview($task, $seenSubmittedAt);

            if ($comment !== null) {
                $this->addComment($mentor, $task, $comment, false, $now);
            }

            $task->update([
                'status' => TaskStatus::Done,
                'done_at' => $now,
                'revise_pending' => false,
            ]);

            return $task;
        });

        $this->notifier->send([$task->intern_id], "Task '{$task->title}' diterima.", '/task', ['open' => $task->id]);

        return $task;
    }

    /**
     * @return array{task: Task, warning: string|null}
     *
     * @throws ActionRejected
     */
    public function revise(User $mentor, Task $task, string $comment, ?string $seenSubmittedAt, CarbonInterface $now): array
    {
        $task = DB::transaction(function () use ($mentor, $task, $comment, $seenSubmittedAt, $now): Task {
            $task = $this->lockInReview($task, $seenSubmittedAt);

            $this->addComment($mentor, $task, $comment, true, $now);

            $task->update([
                'status' => TaskStatus::InProgress,
                'revise_pending' => true,
                'revision_count' => $task->revision_count + 1,
            ]);

            return $task;
        });

        $this->notifier->send([$task->intern_id], "Task '{$task->title}' perlu direvisi.", '/task', ['open' => $task->id, 'to' => 'comments']);

        $task->load('intern.internProfile');

        return ['task' => $task, 'warning' => $this->inactiveWarning($task, $now)];
    }

    public function inactiveWarning(Task $task, CarbonInterface $now): ?string
    {
        return $this->access->denialReason($task->intern, $now) === null ? null : self::INACTIVE_INTERN;
    }

    /**
     * Kunci baris Task dan pastikan masih In Review dengan hasil yang sama seperti yang dilihat mentor.
     *
     * @throws ActionRejected
     */
    private function lockInReview(Task $task, ?string $seenSubmittedAt): Task
    {
        // Dikunci agar pengumpulan ulang intern tidak bertabrakan dengan keputusan ini.
        $task = Task::query()->lockForUpdate()->findOrFail($task->id);

        if ($task->status !== TaskStatus::InReview) {
            throw new ActionRejected(Task::STALE, 'stale');
        }

        if ($seenSubmittedAt !== null && $task->submitted_at !== null
            && ! $task->submitted_at->equalTo(Carbon::parse($seenSubmittedAt))) {
            throw new ActionRejected(self::RESUBMITTED, 'resubmitted');
        }

        return $task;
    }

    private function addComment(User $mentor, Task $task, string $body, bool $isRevision, CarbonInterface $now): TaskComment
    {
        $comment = $task->comments()->create([
            'user_id' => $mentor->id,
            'body' => $body,
            'is_revision' => $isRevision,
        ]);

        // Mentor sedang membuka thread, jadi komentar sebelumnya sudah terbaca.
        TaskRead::query()->updateOrCreate(
            ['task_id' => $task->id, 'user_id' => $mentor->id],
            ['last_read_at' => $now],
        );

        return $comment;
    }
}
