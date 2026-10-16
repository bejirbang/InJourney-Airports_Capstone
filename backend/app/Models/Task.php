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
    'revise_pending', 'revision_count', 'done_at',
])]
class Task extends Model
{
    /** @use HasFactory<TaskFactory> */
    use HasFactory;

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
     * Keterangan tenggat yang lewat, sama dengan lateLabel di mock-rules.ts: "Lewat 3 jam", "Lewat 2 hari".
     */
    public function lateLabel(CarbonInterface $now): string
    {
        $hours = $this->due_at->diffInHours($now);

        return $hours < 24
            ? 'Lewat '.max(1, (int) floor($hours)).' jam'
            : 'Lewat '.(int) floor($hours / 24).' hari';
    }

    /**
     * Label Terlambat, sama dengan taskIsLate di frontend/src/lib/mock-rules.ts.
     * Task Done tidak pernah terlambat. Task In Review dinilai dari waktu pengumpulan terakhir.
     */
    public function isLate(CarbonInterface $now): bool
    {
        return match ($this->status) {
            TaskStatus::Done => false,
            TaskStatus::InReview => ($this->submitted_at ?? $now)->gt($this->due_at),
            default => $now->gt($this->due_at),
        };
    }
}
