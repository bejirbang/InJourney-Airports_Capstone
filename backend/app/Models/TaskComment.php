<?php

namespace App\Models;

use Database\Factories\TaskCommentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $task_id
 * @property int|null $user_id
 * @property string $body
 * @property bool $is_revision
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Task $task
 * @property-read User|null $author
 */
#[Fillable(['task_id', 'user_id', 'body', 'is_revision'])]
class TaskComment extends Model
{
    /** @use HasFactory<TaskCommentFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_revision' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Task, $this>
     */
    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    /**
     * @param  Builder<TaskComment>  $query
     * @return Builder<TaskComment>
     */
    public function scopeUnreadFor(Builder $query, int $userId): Builder
    {
        return $query
            ->where(fn (Builder $q) => $q->whereNull('user_id')->orWhere('user_id', '!=', $userId))
            ->whereNotExists(fn (QueryBuilder $read) => $read
                ->selectRaw('1')
                ->from('task_reads')
                ->whereColumn('task_reads.task_id', 'task_comments.task_id')
                ->where('task_reads.user_id', $userId)
                ->whereColumn('task_reads.last_read_at', '>=', 'task_comments.created_at'));
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withTrashed();
    }
}
