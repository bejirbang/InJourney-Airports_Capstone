<?php

namespace App\Services;

use App\Enums\TaskStatus;
use App\Exceptions\ActionRejected;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class TaskSubmissions
{
    public function __construct(private Notifier $notifier) {}

    /**
     * @throws ActionRejected
     */
    public function submit(User $intern, Task $task, ?string $link, ?UploadedFile $file, ?TaskStatus $seen, CarbonInterface $now): Task
    {
        $newPath = $file?->store("tasks/{$task->id}");
        $newPath = is_string($newPath) ? $newPath : null;

        try {
            [$task, $oldPath, $replacing] = DB::transaction(function () use ($task, $link, $newPath, $seen, $now): array {
                // Dikunci agar Accept atau Revise mentor tidak bertabrakan dengan pengumpulan ini.
                $task = Task::query()->lockForUpdate()->findOrFail($task->id);

                match ($task->status) {
                    TaskStatus::Todo => throw new ActionRejected('Mulai kerjakan Task dulu sebelum mengumpulkan.', 'not_started'),
                    TaskStatus::Done => throw $seen === TaskStatus::InReview
                        ? new ActionRejected('Task sudah diterima mentor.', 'accepted')
                        : new ActionRejected('Task ini sudah selesai.', 'done'),
                    TaskStatus::InProgress, TaskStatus::InReview => null,
                };

                $oldPath = $task->submission_file_path;
                $replacing = $task->status === TaskStatus::InReview;

                $task->update([
                    'submission_link' => $link,
                    'submission_file_path' => $newPath,
                    'submitted_at' => $now,
                    'status' => TaskStatus::InReview,
                    'ever_submitted' => true,
                    'revise_pending' => false,
                ]);

                return [$task, $oldPath, $replacing];
            });
        } catch (Throwable $e) {
            // Hasil tidak tersimpan: file baru jangan tertinggal di storage.
            if ($newPath !== null) {
                Storage::delete($newPath);
            }

            throw $e;
        }

        if ($oldPath !== null && $oldPath !== $newPath) {
            Storage::delete($oldPath);
        }

        $this->notifyMentor($intern, $task, $replacing);

        return $task;
    }

    private function notifyMentor(User $intern, Task $task, bool $replacing): void
    {
        if ($task->mentor_id === null) {
            return;
        }

        $action = $replacing ? 'mengganti hasil Task' : 'mengumpulkan Task';

        $this->notifier->send(
            [$task->mentor_id],
            "{$intern->shortName()} {$action} '{$task->title}'.",
            '/task',
            ['open' => $task->id],
        );
    }
}
