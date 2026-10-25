<?php

namespace App\Models;

use App\Enums\AttendanceStatus;
use App\Enums\CorrectionStatus;
use Database\Factories\AttendanceCorrectionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $intern_id
 * @property int|null $mentor_id
 * @property Carbon $date
 * @property AttendanceStatus $recorded_status
 * @property bool $recorded_missed_clock_out
 * @property string $reason
 * @property CorrectionStatus $status
 * @property string|null $mentor_note
 * @property Carbon|null $mentor_decided_at
 * @property int|null $admin_id
 * @property string|null $admin_note
 * @property Carbon|null $admin_decided_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $intern
 * @property-read User|null $mentor
 * @property-read User|null $admin
 */
#[Fillable([
    'intern_id', 'mentor_id', 'date', 'recorded_status', 'recorded_missed_clock_out', 'reason', 'status',
    'mentor_note', 'mentor_decided_at', 'admin_id', 'admin_note', 'admin_decided_at',
])]
class AttendanceCorrection extends Model
{
    /** @use HasFactory<AttendanceCorrectionFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date' => 'date',
            'recorded_status' => AttendanceStatus::class,
            'recorded_missed_clock_out' => 'boolean',
            'status' => CorrectionStatus::class,
            'mentor_decided_at' => 'datetime',
            'admin_decided_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<AttendanceCorrection>  $query
     * @return Builder<AttendanceCorrection>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', CorrectionStatus::active());
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
        return $this->belongsTo(User::class, 'mentor_id')->withTrashed();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id')->withTrashed();
    }

    public function isActive(): bool
    {
        return $this->status->isActive();
    }
}
