<?php

namespace App\Models;

use Database\Factories\AirportFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $name
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'is_active'])]
class Airport extends Model
{
    /** @use HasFactory<AirportFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /**
     * @param  Builder<Airport>  $query
     * @return Builder<Airport>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * @return HasMany<Office, $this>
     */
    public function offices(): HasMany
    {
        return $this->hasMany(Office::class);
    }

    /**
     * @return HasMany<AirportWeeklySchedule, $this>
     */
    public function weeklySchedules(): HasMany
    {
        return $this->hasMany(AirportWeeklySchedule::class);
    }

    /**
     * @return HasMany<AirportSpecialSchedule, $this>
     */
    public function specialSchedules(): HasMany
    {
        return $this->hasMany(AirportSpecialSchedule::class);
    }

    /**
     * @return HasMany<InternProfile, $this>
     */
    public function internProfiles(): HasMany
    {
        return $this->hasMany(InternProfile::class);
    }
}
