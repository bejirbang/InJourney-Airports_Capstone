<?php

namespace App\Services;

use App\Enums\TaskStatus;
use App\Exceptions\ActionRejected;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskRead;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

class TaskComments
{
    public function __construct(private Notifier $notifier) {}

    /**
     * @throws ActionRejected
     */
    public function reply(User $intern, Task $task, string $body, CarbonInterface $now): TaskComment
    {
        $comment = DB::transaction(function () use ($intern, $task, $body, $now): TaskComment {
            // Dikunci agar komentar tidak masuk setelah mentor menekan Accept di saat yang sama.
            $task = Task::query()->lockForUpdate()->findOrFail($task->id);

            if ($task->status === TaskStatus::Done) {
                throw new ActionRejected(Task::DONE_LOCKED, 'done_locked');
            }

            $comment = $task->comments()->create([
                'user_id' => $intern->id,
                'body' => $body,
                'is_revision' => false,
            ]);

            // Intern sedang membuka thread, jadi komentar sebelumnya sudah terbaca.
            TaskRead::query()->updateOrCreate(
                ['task_id' => $task->id, 'user_id' => $intern->id],
                ['last_read_at' => $now],
            );

            return $comment->setRelation('task', $task);
        });

        $this->notifyMentor($intern, $comment->task);

        return $comment->load('author:id,name,role');
    }

    private function notifyMentor(User $intern, Task $task): void
    {
        if ($task->mentor_id === null) {
            return;
        }

        $this->notifier->send(
            [$task->mentor_id],
            "{$intern->shortName()} membalas komentar di '{$task->title}'.",
            '/task',
            ['open' => $task->id, 'to' => 'comments'],
        );
    }
}
