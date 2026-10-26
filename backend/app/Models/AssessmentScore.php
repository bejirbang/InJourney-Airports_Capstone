<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $assessment_id
 * @property int $indicator_id
 * @property string $score
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Assessment $assessment
 * @property-read AssessmentIndicator $indicator
 */
#[Fillable(['assessment_id', 'indicator_id', 'score'])]
class AssessmentScore extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'score' => 'decimal:2',
        ];
    }

    /**
     * Nilai diisi bilangan bulat 0-100; kolom tetap desimal.
     */
    public function value(): int
    {
        return (int) round((float) $this->score);
    }

    /**
     * @return BelongsTo<Assessment, $this>
     */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    /**
     * @return BelongsTo<AssessmentIndicator, $this>
     */
    public function indicator(): BelongsTo
    {
        return $this->belongsTo(AssessmentIndicator::class, 'indicator_id');
    }
}
