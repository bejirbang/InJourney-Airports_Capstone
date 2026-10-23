<?php

namespace App\Http\Resources;

use App\Enums\TaskStatus;
use App\Models\Task;
use App\Models\TaskComment;
use Illuminate\Http\Request;

/**
 * @mixin Task
 */
class MentorTaskDetailResource extends MentorTaskResource
{
    /**
     * @var list<int>
     */
    public array $unreadIds = [];

    public ?string $inactiveWarning = null;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'intern_is_active' => $this->inactiveWarning === null,
            'submission' => $this->submissionData(),
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
