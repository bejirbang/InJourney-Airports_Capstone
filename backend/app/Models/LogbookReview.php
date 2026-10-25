<?php

namespace App\Models;

use App\Enums\LogbookReviewAction;
use Database\Factories\LogbookReviewFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $logbook_id
 * @property int|null $mentor_id
 * @property LogbookReviewAction $action
 * @property string|null $comment
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Logbook $logbook
 * @property-read User|null $mentor
 */
#[Fillable(['logbook_id', 'mentor_id', 'action', 'comment'])]
class LogbookReview extends Model
{
    /** @use HasFactory<LogbookReviewFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'action' => LogbookReviewAction::class,
        ];
    }

    /**
     * @return BelongsTo<Logbook, $this>
     */
    public function logbook(): BelongsTo
    {
        return $this->belongsTo(Logbook::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function mentor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mentor_id')->withTrashed();
    }
}
