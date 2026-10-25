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
 * @property int $airport_id
 * @property string $university
 * @property string $major
 * @property Carbon $start_date
 * @property Carbon $end_date
 * @property Carbon $leave_quota_since
 * @property Carbon|null $presentation_reminded_at
 * @property Carbon|null $ending_notified_for
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 * @property-read User $mentor
 * @property-read Airport $airport
 */
#[Fillable([
    'user_id', 'mentor_id', 'airport_id', 'university', 'major', 'start_date', 'end_date',
    'leave_quota_since', 'presentation_reminded_at', 'ending_notified_for',
])]
class InternProfile extends Model
{
    /** @use HasFactory<InternProfileFactory> */
    use HasFactory;

    public const ENDING_SOON_DAYS = 7;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'leave_quota_since' => 'date',
            'presentation_reminded_at' => 'datetime',
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
     * @return BelongsTo<Airport, $this>
     */
    public function airport(): BelongsTo
    {
        return $this->belongsTo(Airport::class);
    }

    /**
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

    public function daysLeft(CarbonInterface $today): int
    {
        return (int) $today->copy()->startOfDay()->diffInDays($this->end_date->copy()->startOfDay(), false);
    }
}
