<?php

namespace App\Http\Resources;

use App\Enums\RequestStatus;
use App\Models\LeaveRequest;
use App\Services\AttendanceCalendar;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin LeaveRequest
 */
class InternLeaveResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $start = $this->start_date->toDateString();

        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'start_date' => $start,
            'end_date' => $this->end_date->toDateString(),
            'working_days' => app(AttendanceCalendar::class)->workingDays($start, $this->end_date->toDateString()),
            'reason' => $this->reason,
            'has_evidence' => $this->evidence_path !== null,
            'status' => $this->status->value,
            'submitted_at' => $this->created_at?->toIso8601String(),
            'submitted_late' => $this->created_at !== null && $this->created_at->toDateString() > $start,
            'decided_by' => $this->whenLoaded('decider', fn () => $this->decider === null ? null : [
                'name' => $this->decider->name,
                'role' => $this->decider->role->value,
            ]),
            'decision_note' => $this->decision_note,
            'decided_at' => $this->decided_at?->toIso8601String(),
            'can_cancel' => $this->status === RequestStatus::Pending,
        ];
    }
}
