<?php

namespace App\Http\Resources;

use App\Enums\RequestStatus;
use App\Models\LeaveRequest;
use App\Services\LeaveQuotas;
use App\Services\SystemSettings;
use App\Services\WorkSchedules;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Date;

/**
 * @mixin LeaveRequest
 */
class MentorLeaveResource extends JsonResource
{
    public bool $detail = false;

    public function withDetail(): static
    {
        $this->detail = true;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $start = $this->start_date->toDateString();
        $now = Date::now();
        $hours = app(SystemSettings::class)->leaveEscalationHours();

        return [
            'id' => $this->id,
            'intern' => ['id' => $this->intern->id, 'name' => $this->intern->name, 'short_name' => $this->intern->shortName()],
            'type' => $this->type->value,
            'start_date' => $start,
            'end_date' => $this->end_date->toDateString(),
            'working_days' => app(WorkSchedules::class)->workingDays($this->intern, $start, $this->end_date->toDateString()),
            'evidence_url' => $this->evidence_url,
            'status' => $this->status->value,
            'submitted_at' => $this->created_at?->toIso8601String(),
            'submitted_late' => $this->created_at !== null && $this->created_at->toDateString() > $start,
            'pending_hours' => $this->pendingHours($now),
            'is_overdue' => $this->isOverduePending($now, $hours),
            'decided_by' => $this->decider === null ? null : [
                'name' => $this->decider->name,
                'role' => $this->decider->role->value,
            ],
            'decided_at' => $this->decided_at?->toIso8601String(),
            'can_decide' => $this->status === RequestStatus::Pending,
            'reason' => $this->when($this->detail, fn () => $this->reason),
            'decision_note' => $this->when($this->detail, fn () => $this->decision_note),
            'quota' => $this->when($this->detail, fn () => app(LeaveQuotas::class)->summary($this->intern->loadMissing('internProfile'))),
        ];
    }
}
