<?php

namespace App\Models;

use Database\Factories\WorkHourSettingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Jam kerja global. Perubahan berlaku mulai `effective_from` dan tidak mengubah data sebelumnya
 * (docs/design-admin.md, Alur 7).
 *
 * @property int $id
 * @property string $start_time
 * @property string $end_time
 * @property Carbon $effective_from
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['start_time', 'end_time', 'effective_from'])]
class WorkHourSetting extends Model
{
    /** @use HasFactory<WorkHourSettingFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'effective_from' => 'date',
        ];
    }

    /**
     * Jam kerja yang berlaku pada tanggal (Y-m-d), atau null jika admin belum mengaturnya.
     */
    public static function effectiveOn(string $date): ?self
    {
        return self::query()
            ->whereDate('effective_from', '<=', $date)
            ->orderByDesc('effective_from')
            ->first();
    }

    /**
     * Semua pengaturan yang mungkin berlaku sampai $to, terbaru lebih dulu. Dipakai bersama
     * pickFor() agar rentang tanggal tidak perlu satu query per hari.
     *
     * @return Collection<int, WorkHourSetting>
     */
    public static function upTo(string $to): Collection
    {
        return self::query()
            ->whereDate('effective_from', '<=', $to)
            ->orderByDesc('effective_from')
            ->get();
    }

    /**
     * @param  Collection<int, WorkHourSetting>  $settings  hasil upTo()
     */
    public static function pickFor(Collection $settings, string $date): ?self
    {
        return $settings->first(fn (self $setting): bool => $setting->effective_from->toDateString() <= $date);
    }

    /**
     * @return array{start: string, end: string}
     */
    public function toHours(): array
    {
        return [
            'start' => substr($this->start_time, 0, 5),
            'end' => substr($this->end_time, 0, 5),
        ];
    }
}
