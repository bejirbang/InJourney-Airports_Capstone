<?php

namespace App\Models;

use App\Enums\RequestStatus;
use Database\Factories\AttendanceCorrectionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $intern_id
 * @property Carbon $date
 * @property string|null $recorded_clock_in
 * @property string|null $recorded_clock_out
 * @property string $requested_clock_in
 * @property string $requested_clock_out
 * @property string $reason
 * @property string|null $evidence_path
 * @property RequestStatus $status
 * @property int|null $decided_by
 * @property string|null $decision_note
 * @property string|null $final_clock_in
 * @property string|null $final_clock_out
 * @property Carbon|null $decided_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $intern
 * @property-read User|null $decider
 */
#[Fillable([
    'intern_id', 'date', 'recorded_clock_in', 'recorded_clock_out', 'requested_clock_in', 'requested_clock_out',
    'reason', 'evidence_path', 'status', 'decided_by', 'decision_note', 'final_clock_in', 'final_clock_out', 'decided_at',
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
            'status' => RequestStatus::class,
            'decided_at' => 'datetime',
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
    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function isPending(): bool
    {
        return $this->status === RequestStatus::Pending;
    }
}
