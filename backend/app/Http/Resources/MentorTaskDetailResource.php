<?php

namespace App\Http\Resources;

use App\Enums\TaskStatus;
use App\Models\Task;
use App\Models\TaskComment;
use Illuminate\Http\Request;

/**
 * Layar detail Task mentor (docs/design-mentor.md 8.2): kartu Task ditambah hasil kumpulan dan thread komentar.
 *
 * @mixin Task
 */
class MentorTaskDetailResource extends MentorTaskResource
{
    /**
     * Id komentar yang belum dibaca mentor sebelum detail dibuka, untuk disorot.
     *
     * @var list<int>
     */
    public array $unreadIds = [];

    /**
     * Peringatan untuk dialog Revise jika intern sudah nonaktif (8.6).
     */
    public ?string $inactiveWarning = null;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'intern_is_active' => $this->inactiveWarning === null,
            // Bentuk sama dengan detail Task intern; "Dikumpulkan terlambat" dan "(terlambat 15 jam)" (7.5, 8.2).
            'submission' => $this->submissionData(),
            // Tombol Accept dan Revise hanya saat In Review; Task Done hanya baca.
            'can_review' => $this->status === TaskStatus::InReview,
            'can_comment' => $this->status !== TaskStatus::Done,
            'revise_warning' => $this->inactiveWarning,
            'comments' => $this->comments
                ->map(fn (TaskComment $comment): TaskCommentResource => (new TaskCommentResource($comment))
                    ->markUnread(in_array($comment->id, $this->unreadIds, true)))
                ->all(),
        ];
    }
}
