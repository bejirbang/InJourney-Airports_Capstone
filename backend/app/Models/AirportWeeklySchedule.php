<?php

namespace App\Models;

use Database\Factories\AirportWeeklyScheduleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $airport_id
 * @property int $day_of_week
 * @property bool $is_workday
 * @property string|null $start_time
 * @property string|null $end_time
 * @property Carbon $effective_from
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Airport $airport
 */
#[Fillable(['airport_id', 'day_of_week', 'is_workday', 'start_time', 'end_time', 'effective_from'])]
class AirportWeeklySchedule extends Model
{
    /** @use HasFactory<AirportWeeklyScheduleFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'day_of_week' => 'integer',
            'is_workday' => 'boolean',
            'effective_from' => 'date',
        ];
    }

    /**
     * @return BelongsTo<Airport, $this>
     */
    public function airport(): BelongsTo
    {
        return $this->belongsTo(Airport::class);
    }
}
