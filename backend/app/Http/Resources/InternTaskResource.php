<?php

namespace App\Http\Resources;

use App\Enums\TaskStatus;
use App\Models\Task;
use App\Models\TaskComment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Date;

/**
 * Kartu Task untuk intern (Kanban dan Daftar). Bagian detail hanya ada jika komentar dimuat.
 *
 * @mixin Task
 */
class InternTaskResource extends JsonResource
{
    /**
     * Id komentar yang belum dibaca sebelum detail dibuka, untuk disorot.
     *
     * @var list<int>
     */
    public array $unreadIds = [];

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $now = Date::now();
        $late = $this->isLate($now);

        return [
            'id' => $this->id,
            'code' => $this->code,
            'title' => $this->title,
            'mentor' => $this->mentor === null ? null : ['id' => $this->mentor->id, 'name' => $this->mentor->name],
            'status' => $this->status->value,
            'due_at' => $this->due_at->toIso8601String(),
            'is_late' => $late,
            // "Lewat 2 hari" hanya selama Task belum dikumpulkan; Task In Review dinilai dari waktu kumpul.
            'late_label' => $late && $this->status !== TaskStatus::InReview ? $this->lateLabel($now) : null,
            'done_at' => $this->done_at?->toIso8601String(),
            'unread_comments' => (int) ($this->unread_comments_count ?? 0),
            'ever_submitted' => $this->ever_submitted,
            // Banner "Mentor meminta revisi. Lihat komentar di bawah."
            'revise_pending' => $this->revise_pending,
            // Tombol di detail (10.4): start = Mulai Kerjakan, submit = Kumpulkan Hasil, replace = Ganti Hasil.
            'action' => match ($this->status) {
                TaskStatus::Todo => 'start',
                TaskStatus::InProgress => 'submit',
                TaskStatus::InReview => 'replace',
                TaskStatus::Done => null,
            },
            'description' => $this->when($this->relationLoaded('comments'), fn () => $this->description),
            'submission' => $this->when($this->relationLoaded('comments'), fn () => $this->submitted_at === null ? null : [
                'link' => $this->submission_link,
                'has_file' => $this->submission_file_path !== null,
                'submitted_at' => $this->submitted_at->toIso8601String(),
            ]),
            // Thread terkunci pada Task Done.
            'can_comment' => $this->when($this->relationLoaded('comments'), fn () => $this->status !== TaskStatus::Done),
            'comments' => $this->when($this->relationLoaded('comments'), fn () => $this->comments
                ->map(fn (TaskComment $comment): TaskCommentResource => (new TaskCommentResource($comment))
                    ->markUnread(in_array($comment->id, $this->unreadIds, true)))
                ->all()),
        ];
    }
}
