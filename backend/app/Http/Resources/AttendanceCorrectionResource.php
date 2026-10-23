<?php

namespace App\Http\Resources;

use App\Models\AttendanceCorrection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin AttendanceCorrection
 */
class AttendanceCorrectionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $time = fn (?string $value): ?string => $value === null ? null : substr($value, 0, 5);

        return [
            'id' => $this->id,
            'date' => $this->date->toDateString(),
            'submitted_at' => $this->created_at?->toIso8601String(),
            'status' => $this->status->value,
            'recorded' => ['clock_in' => $time($this->recorded_clock_in), 'clock_out' => $time($this->recorded_clock_out)],
            'requested' => ['clock_in' => $time($this->requested_clock_in), 'clock_out' => $time($this->requested_clock_out)],
            'reason' => $this->reason,
            'has_evidence' => $this->evidence_path !== null,
            'decision_note' => $this->decision_note,
            'final' => $this->final_clock_in === null ? null : [
                'clock_in' => $time($this->final_clock_in),
                'clock_out' => $time($this->final_clock_out),
            ],
            'decided_by' => $this->whenLoaded('decider', fn () => $this->decider?->name),
            'decided_at' => $this->decided_at?->toIso8601String(),
            'can_cancel' => $this->isPending(),
        ];
    }
}
