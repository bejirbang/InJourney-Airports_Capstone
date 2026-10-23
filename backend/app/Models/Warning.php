<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\WarningFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $intern_id
 * @property int|null $author_id
 * @property string $body
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User|null $intern
 * @property-read User|null $author
 */
#[Fillable(['intern_id', 'author_id', 'body'])]
class Warning extends Model
{
    /** @use HasFactory<WarningFactory> */
    use HasFactory;

    public const EDIT_WINDOW_HOURS = 24;

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
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id')->withTrashed();
    }

    public function editableBy(User $admin, CarbonInterface $now): bool
    {
        return $this->author_id === $admin->id
            && $this->created_at !== null
            && $now->lessThanOrEqualTo($this->created_at->copy()->addHours(self::EDIT_WINDOW_HOURS));
    }
}
