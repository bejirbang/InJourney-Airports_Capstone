<?php

namespace App\Models;

use App\Enums\TaskStatus;
use Carbon\CarbonInterface;
use Database\Factories\TaskFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property string $code
 * @property string $title
 * @property string $description
 * @property int $intern_id
 * @property int|null $mentor_id
 * @property Carbon $due_at
 * @property TaskStatus $status
 * @property string|null $submission_link
 * @property string|null $submission_file_path
 * @property Carbon|null $submitted_at
 * @property bool $ever_submitted
 * @property bool $revise_pending
 * @property int $revision_count
 * @property Carbon|null $done_at
 * @property Carbon|null $overdue_reminded_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $intern
 * @property-read User|null $mentor
 * @property-read Collection<int, TaskComment> $comments
 * @property-read Collection<int, TaskRead> $reads
 * @property-read int|null $unread_comments_count
 */
#[Fillable([
    'code', 'title', 'description', 'intern_id', 'mentor_id', 'due_at', 'status',
    'submission_link', 'submission_file_path', 'submitted_at', 'ever_submitted',
    'revise_pending', 'revision_count', 'done_at', 'overdue_reminded_at',
])]
class Task extends Model
{
    /** @use HasFactory<TaskFactory> */
    use HasFactory;

    public const STALE = 'Status Task sudah berubah. Muat ulang.';

    public const DONE_LOCKED = 'Task sudah selesai dan terkunci.';

    public const DONE_DAYS = 30;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
            'status' => TaskStatus::class,
            'submitted_at' => 'datetime',
            'ever_submitted' => 'boolean',
            'revise_pending' => 'boolean',
            'done_at' => 'datetime',
            'overdue_reminded_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function intern(): BelongsTo
    {
        return $this->belongsTo(User::class, 'intern_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function mentor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mentor_id');
    }

    /**
     * @return HasMany<TaskComment, $this>
     */
    public function comments(): HasMany
    {
        return $this->hasMany(TaskComment::class);
    }

    /**
     * @return HasMany<TaskRead, $this>
     */
    public function reads(): HasMany
    {
        return $this->hasMany(TaskRead::class);
    }

    /**
     * @param  Collection<int, Task>  $tasks
     * @return array{tasks: Collection<int, Task>, hidden_done: int}
     */
    public static function withoutOldDone(Collection $tasks, bool $includeOlderDone, CarbonInterface $now): array
    {
        $since = $now->copy()->subDays(self::DONE_DAYS);
        $isOldDone = fn (Task $task): bool => $task->status === TaskStatus::Done
            && $task->done_at !== null && $task->done_at->lt($since);
        $hidden = $includeOlderDone ? 0 : $tasks->filter($isOldDone)->count();

        return [
            'tasks' => $hidden === 0 ? $tasks : $tasks->reject($isOldDone)->values(),
            'hidden_done' => $hidden,
        ];
    }

    /**
     * @return list<int>
     */
    public function markCommentsRead(User $user, CarbonInterface $now): array
    {
        $unread = $this->comments()->unreadFor($user->id)->orderBy('id')->pluck('id')->all();

        TaskRead::query()->updateOrCreate(
            ['task_id' => $this->id, 'user_id' => $user->id],
            ['last_read_at' => $now],
        );

        return array_map('intval', $unread);
    }

    /**
     * @return array{link: string|null, file: array{name: string, size: int|null}|null, submitted_at: string, submitted_late: bool, late_hours: int|null}|null
     */
    public function submissionData(): ?array
    {
        if ($this->submitted_at === null) {
            return null;
        }

        $file = $this->submission_file_path;
        $late = $this->submitted_at->gt($this->due_at);

        return [
            'link' => $this->submission_link,
            'file' => $file === null ? null : [
                'name' => $this->submissionFileName(),
                'size' => Storage::exists($file) ? Storage::size($file) : null,
            ],
            'submitted_at' => $this->submitted_at->toIso8601String(),
            'submitted_late' => $late,
            'late_hours' => $late ? (int) round($this->due_at->diffInMinutes($this->submitted_at) / 60) : null,
        ];
    }

    public function submissionFileName(): string
    {
        return "hasil-{$this->code}.".pathinfo((string) $this->submission_file_path, PATHINFO_EXTENSION);
    }

    public function lateLabel(CarbonInterface $now): string
    {
        $hours = $this->due_at->diffInHours($now);

        return $hours < 24
            ? 'Lewat '.max(1, (int) floor($hours)).' jam'
            : 'Lewat '.(int) floor($hours / 24).' hari';
    }

    public function isLate(CarbonInterface $now): bool
    {
        return match ($this->status) {
            TaskStatus::Done => false,
            TaskStatus::InReview => ($this->submitted_at ?? $now)->gt($this->due_at),
            default => $now->gt($this->due_at),
        };
    }
}
