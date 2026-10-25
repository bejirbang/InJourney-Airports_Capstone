<?php

namespace App\Http\Resources;

use App\Models\LeaveRequest;
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

        return [
            ...parent::toArray($request),
            'mentor' => $mentor === null ? null : ['id' => $mentor->id, 'name' => $mentor->name],
            'can_approve' => $this->isOverduePending(Date::now()) && $this->evidence_url !== null,
        ];
    }
}
