<?php

namespace App\Http\Resources;

use App\Enums\LogbookReviewAction;
use App\Models\Logbook;
use App\Models\LogbookReview;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Logbook
 */
class MentorLogbookResource extends JsonResource
{
    /** @var array<string, mixed>|null */
    private ?array $detail = null;

    /**
     * @param  array<string, mixed>  $detail
     */
    public function withDetail(array $detail): static
    {
        $this->detail = $detail;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $attendance = $this->attendance;
        $intern = $attendance->intern;

        return [
            'id' => $this->id,
            'intern' => ['id' => $intern->id, 'name' => $intern->name, 'short_name' => $intern->shortName()],
            'date' => $attendance->date->toDateString(),
            'work' => $this->work,
            'status' => $this->status->value,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            // Label "Diisi setelah koreksi presensi".
            'is_corrected' => $attendance->is_corrected,
            'revision_count' => $this->reviews->filter(fn (LogbookReview $review): bool => $review->action === LogbookReviewAction::Revision)->count(),
            ...($this->detail === null ? [] : [
                'notes' => $this->notes,
                'approved_at' => $this->approved_at?->toIso8601String(),
                'attendance' => [
                    'status' => $attendance->status()->value,
                    'clock_in_at' => $attendance->clock_in_at === null ? null : substr($attendance->clock_in_at, 0, 5),
                    'clock_out_at' => $attendance->clock_out_at === null ? null : substr($attendance->clock_out_at, 0, 5),
                ],
                'reviews' => array_values($this->reviews->sortByDesc('id')->map(fn (LogbookReview $review): array => [
                    'action' => $review->action->value,
                    'comment' => $review->comment,
                    'mentor' => $review->mentor?->name,
                    'created_at' => $review->created_at?->toIso8601String(),
                ])->all()),
                ...$this->detail,
            ]),
        ];
    }
}
