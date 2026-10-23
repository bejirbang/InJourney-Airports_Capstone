<?php

namespace App\Http\Resources;

use App\Enums\RequestStatus;
use App\Models\AttendanceCorrection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin AttendanceCorrection
 */
class AdminCorrectionResource extends JsonResource
{
    private bool $detail = false;

    private ?string $currentStatus = null;

    public function withDetail(?string $currentStatus): static
    {
        $this->detail = true;
        $this->currentStatus = $currentStatus;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $time = fn (?string $value): ?string => $value === null ? null : substr($value, 0, 5);

        return [
            'id' => $this->id,
            'intern' => ['id' => $this->intern->id, 'name' => $this->intern->name, 'short_name' => $this->intern->shortName()],
            'date' => $this->date->toDateString(),
            'submitted_at' => $this->created_at?->toIso8601String(),
            'status' => $this->status->value,
            ...(! $this->detail ? [] : [
                'recorded' => [
                    'clock_in' => $time($this->recorded_clock_in),
                    'clock_out' => $time($this->recorded_clock_out),
                    'status' => $this->currentStatus,
                ],
                'requested' => ['clock_in' => $time($this->requested_clock_in), 'clock_out' => $time($this->requested_clock_out)],
                'reason' => $this->reason,
                'has_evidence' => $this->evidence_path !== null,
                'decision_note' => $this->decision_note,
                'final' => $this->final_clock_in === null ? null : [
                    'clock_in' => $time($this->final_clock_in),
                    'clock_out' => $time($this->final_clock_out),
                ],
                'decided_by' => $this->decider?->name,
                'decided_at' => $this->decided_at?->toIso8601String(),
                'can_decide' => $this->status === RequestStatus::Pending,
            ]),
        ];
    }
}
