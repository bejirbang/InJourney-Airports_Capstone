<?php

namespace App\Models;

use App\Enums\LogbookStatus;
use Database\Factories\LogbookFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $attendance_id
 * @property string $work
 * @property string|null $notes
 * @property LogbookStatus $status
 * @property Carbon|null $submitted_at
 * @property Carbon|null $approved_at
 * @property int|null $approved_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Attendance $attendance
 * @property-read User|null $approver
 * @property-read Collection<int, LogbookReview> $reviews
 */
#[Fillable(['attendance_id', 'work', 'notes', 'status', 'submitted_at', 'approved_at', 'approved_by'])]
class Logbook extends Model
{
    /** @use HasFactory<LogbookFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => LogbookStatus::class,
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Attendance, $this>
     */
    public function attendance(): BelongsTo
    {
        return $this->belongsTo(Attendance::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by')->withTrashed();
    }

    /**
     * @return HasMany<LogbookReview, $this>
     */
    public function reviews(): HasMany
    {
        return $this->hasMany(LogbookReview::class);
    }
}
