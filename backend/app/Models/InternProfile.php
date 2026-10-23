<?php

namespace App\Models;

use App\Enums\Role;
use Carbon\CarbonInterface;
use Database\Factories\InternProfileFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property int $mentor_id
 * @property Carbon $start_date
 * @property Carbon $end_date
 * @property Carbon|null $ending_notified_for
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 * @property-read User $mentor
 */
#[Fillable(['user_id', 'mentor_id', 'start_date', 'end_date'])]
class InternProfile extends Model
{
    /** @use HasFactory<InternProfileFactory> */
    use HasFactory;

    /** Pengingat "Magang berakhir dalam 7 hari": H-7 sampai hari H (docs/design-admin.md 5.2, 8). */
    public const ENDING_SOON_DAYS = 7;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'ending_notified_for' => 'date',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function mentor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mentor_id');
    }

    /**
     * Intern aktif yang sudah mulai magang dan tanggal selesainya hari ini sampai 7 hari lagi.
     * Akun yang dinonaktifkan admin atau sudah dihapus tidak ikut.
     *
     * @param  Builder<InternProfile>  $query
     * @return Builder<InternProfile>
     */
    public function scopeEndingSoon(Builder $query, string $date): Builder
    {
        $until = Carbon::parse($date)->addDays(self::ENDING_SOON_DAYS)->toDateString();

        return $query
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->whereDate('end_date', '<=', $until)
            ->whereHas('user', fn (Builder $q) => $q->where('role', Role::Intern)->where('is_active', true));
    }

    /**
     * Sisa hari sampai tanggal selesai (0 = hari ini hari terakhir).
     */
    public function daysLeft(CarbonInterface $today): int
    {
        return (int) $today->copy()->startOfDay()->diffInDays($this->end_date->copy()->startOfDay(), false);
    }
}
