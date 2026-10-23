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
 * Satu baris per intern per hari, dibuat saat clock in. Hari tanpa clock in tidak punya baris.
 *
 * @property int $id
 * @property int $intern_id
 * @property int|null $clock_in_office_id
 * @property int|null $clock_out_office_id
 * @property Carbon $date
 * @property string $clock_in_at
 * @property string|null $clock_out_at
 * @property string|null $clock_in_latitude
 * @property string|null $clock_in_longitude
 * @property string|null $clock_out_latitude
 * @property string|null $clock_out_longitude
 * @property bool $is_corrected
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $intern
 * @property-read Office|null $clockInOffice
 * @property-read Office|null $clockOutOffice
 * @property-read DailyReport|null $dailyReport
 */
#[Fillable([
    'intern_id', 'clock_in_office_id', 'clock_out_office_id', 'date', 'clock_in_at', 'clock_out_at',
    'clock_in_latitude', 'clock_in_longitude', 'clock_out_latitude', 'clock_out_longitude', 'is_corrected',
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
            'is_corrected' => 'boolean',
        ];
    }

    /**
     * Menit terlambat clock in terhadap jam masuk yang berlaku hari itu, dihitung per menit
     * (clock in 08:00 tepat waktu, 08:01 terlambat 1 menit). 0 berarti tepat waktu,
     * null berarti admin belum mengatur jam kerja. Hanya tanda; status hari itu tetap dihitung biasa.
     */
    public function lateMinutes(?WorkHourSetting $hours): ?int
    {
        if ($hours === null) {
            return null;
        }

        $toMinutes = fn (string $time): int => (int) substr($time, 0, 2) * 60 + (int) substr($time, 3, 2);

        return max(0, $toMinutes($this->clock_in_at) - $toMinutes($hours->start_time));
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function intern(): BelongsTo
    {
        return $this->belongsTo(User::class, 'intern_id');
    }

    /**
     * Termasuk kantor yang sudah dihapus admin, agar riwayat tetap menampilkan namanya.
     *
     * @return BelongsTo<Office, $this>
     */
    public function clockInOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'clock_in_office_id')->withTrashed();
    }

    /**
     * Termasuk kantor yang sudah dihapus admin, agar riwayat tetap menampilkan namanya.
     *
     * @return BelongsTo<Office, $this>
     */
    public function clockOutOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'clock_out_office_id')->withTrashed();
    }

    /**
     * @return HasOne<DailyReport, $this>
     */
    public function dailyReport(): HasOne
    {
        return $this->hasOne(DailyReport::class);
    }
}
