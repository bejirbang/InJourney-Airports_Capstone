<?php

namespace App\Models;

use Database\Factories\OfficeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Lokasi kantor dan dua radius, dibuat admin di menu Lokasi Kantor (docs/design-admin.md, Bagian 9A).
 *
 * @property int $id
 * @property string $name
 * @property string $latitude
 * @property string $longitude
 * @property int $clock_in_radius_meters
 * @property int $clock_out_radius_meters
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'latitude', 'longitude', 'clock_in_radius_meters', 'clock_out_radius_meters', 'is_active'])]
class Office extends Model
{
    /** @use HasFactory<OfficeFactory> */
    use HasFactory;

    public const EARTH_RADIUS_METERS = 6371000;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'clock_in_radius_meters' => 'integer',
            'clock_out_radius_meters' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @param  Builder<Office>  $query
     * @return Builder<Office>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Jarak dari titik kantor dalam meter (rumus Haversine, sama dengan distanceMeters di mock-rules.ts).
     */
    public function distanceTo(float $latitude, float $longitude): float
    {
        $lat1 = deg2rad((float) $this->latitude);
        $lat2 = deg2rad($latitude);
        $dLat = $lat2 - $lat1;
        $dLng = deg2rad($longitude - (float) $this->longitude);

        $h = sin($dLat / 2) ** 2 + cos($lat1) * cos($lat2) * sin($dLng / 2) ** 2;

        return 2 * self::EARTH_RADIUS_METERS * asin(min(1.0, sqrt($h)));
    }
}
