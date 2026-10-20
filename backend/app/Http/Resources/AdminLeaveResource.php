<?php

namespace App\Http\Resources;

use App\Models\LeaveRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;

/**
 * Izin dari sisi admin (docs/design-admin.md 7.2 dan 7.3): bentuk sama dengan sisi mentor, ditambah
 * mentor intern saat ini. Tolak untuk semua izin Pending; Setujui hanya untuk izin Pending lebih dari
 * 24 jam yang punya bukti (7.4). Muat `intern.internProfile.mentor` dan `decider` lebih dulu.
 *
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
            // `can_decide` (dari sisi mentor) = masih Pending: tombol Tolak aktif.
            // Setujui hanya setelah Pending lebih dari 24 jam dan ada bukti; selain itu nonaktif.
            'can_approve' => $this->isOverduePending(Date::now()) && $this->evidence_path !== null,
        ];
    }
}
