<?php

namespace App\Models;

use Database\Factories\AirportSpecialScheduleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $airport_id
 * @property string $name
 * @property Carbon $start_date
 * @property Carbon $end_date
 * @property string $start_time
 * @property string $end_time
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Airport $airport
 */
#[Fillable(['airport_id', 'name', 'start_date', 'end_date', 'start_time', 'end_time'])]
class AirportSpecialSchedule extends Model
{
    /** @use HasFactory<AirportSpecialScheduleFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }

    /**
     * @return BelongsTo<Airport, $this>
     */
    public function airport(): BelongsTo
    {
        return $this->belongsTo(Airport::class);
    }

    public function covers(string $date): bool
    {
        return $this->start_date->toDateString() <= $date && $date <= $this->end_date->toDateString();
    }
}
