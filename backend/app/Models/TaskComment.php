<?php

namespace App\Models;

use Database\Factories\TaskCommentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Komentar Task, thread dua arah intern dan mentor. Tidak bisa diedit atau dihapus.
 *
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
     * Kosong jika akun penulis sudah dihapus permanen.
     *
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withTrashed();
    }
}
