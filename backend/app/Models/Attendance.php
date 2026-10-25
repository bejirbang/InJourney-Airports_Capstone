<?php

namespace App\Models;

use Database\Factories\AttendanceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $intern_id
 * @property int|null $clock_in_office_id
 * @property int|null $clock_out_office_id
 * @property Carbon $date
 * @property string|null $clock_in_at
 * @property string|null $clock_out_at
 * @property string|null $clock_in_latitude
 * @property string|null $clock_in_longitude
 * @property string|null $clock_out_latitude
 * @property string|null $clock_out_longitude
 * @property string $scheduled_start
 * @property string $scheduled_end
 * @property int $late_tolerance_minutes
 * @property bool $is_corrected
 * @property int|null $correction_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $intern
 * @property-read Office|null $clockInOffice
 * @property-read Office|null $clockOutOffice
 * @property-read Logbook|null $logbook
 * @property-read AttendanceCorrection|null $correction
 */
#[Fillable([
    'intern_id', 'clock_in_office_id', 'clock_out_office_id', 'date', 'clock_in_at', 'clock_out_at',
    'clock_in_latitude', 'clock_in_longitude', 'clock_out_latitude', 'clock_out_longitude',
    'scheduled_start', 'scheduled_end', 'late_tolerance_minutes', 'is_corrected', 'correction_id',
])]
class Attendance extends Model
{
    /** @use HasFactory<AttendanceFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date' => 'date',
            'late_tolerance_minutes' => 'integer',
            'is_corrected' => 'boolean',
        ];
    }

    /**
     * Menit lewat dari jam masuk yang disalin saat baris dibuat. 0 berarti tepat waktu,
     * null berarti tidak ada jam clock in (Lupa Clock In).
     */
    public function lateMinutes(): ?int
    {
        if ($this->clock_in_at === null) {
            return null;
        }

        return max(0, self::minutes($this->clock_in_at) - self::minutes($this->scheduled_start));
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function intern(): BelongsTo
    {
        return $this->belongsTo(User::class, 'intern_id');
    }

    /**
     * @return BelongsTo<Office, $this>
     */
    public function clockInOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'clock_in_office_id');
    }

    /**
     * @return BelongsTo<Office, $this>
     */
    public function clockOutOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'clock_out_office_id');
    }

    /**
     * @return HasOne<Logbook, $this>
     */
    public function logbook(): HasOne
    {
        return $this->hasOne(Logbook::class);
    }

    /**
     * @return BelongsTo<AttendanceCorrection, $this>
     */
    public function correction(): BelongsTo
    {
        return $this->belongsTo(AttendanceCorrection::class, 'correction_id');
    }

    private static function minutes(string $time): int
    {
        return (int) substr($time, 0, 2) * 60 + (int) substr($time, 3, 2);
    }
}
