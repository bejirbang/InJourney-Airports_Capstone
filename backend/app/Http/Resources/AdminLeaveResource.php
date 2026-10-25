<?php

namespace App\Http\Resources;

use App\Enums\RequestStatus;
use App\Models\LeaveRequest;
use App\Services\SystemSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;

/**
 * @mixin LeaveRequest
 */
class AdminLeaveResource extends MentorLeaveResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $mentor = $this->intern->internProfile?->mentor;
        $overdue = $this->isOverduePending(Date::now(), app(SystemSettings::class)->leaveEscalationHours());

        return [
            ...parent::toArray($request),
            'mentor' => $mentor === null ? null : ['id' => $mentor->id, 'name' => $mentor->name],
            // Admin hanya memutuskan izin yang menunggu lebih dari batas eskalasi; Setujui hanya jika ada link bukti.
            'can_decide' => $this->status === RequestStatus::Pending && $overdue,
            'can_approve' => $overdue && $this->evidence_url !== null,
        ];
    }
}
