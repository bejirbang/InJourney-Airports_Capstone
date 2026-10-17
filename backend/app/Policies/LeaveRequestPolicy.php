<?php

namespace App\Policies;

use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Intern hanya melihat dan membatalkan izinnya sendiri.
 * Mentor hanya melihat dan memutuskan izin intern yang saat ini dibimbingnya
 * (izin pending ikut pindah saat ganti mentor, design-mentor.md 13.1).
 * Penolakan dibalas 403 dengan pesan Indonesia.
 */
class LeaveRequestPolicy
{
    public const FORBIDDEN = 'Anda tidak memiliki akses ke izin ini.';

    public function view(User $user, LeaveRequest $leave): Response
    {
        return $this->ownedByIntern($user, $leave);
    }

    public function cancel(User $user, LeaveRequest $leave): Response
    {
        return $this->ownedByIntern($user, $leave);
    }

    /**
     * Mentor: detail, lampiran, Setujui, Tolak (design-mentor.md Alur 7).
     */
    public function manage(User $user, LeaveRequest $leave): Response
    {
        $mentored = $leave->intern()
            ->whereHas('internProfile', fn ($q) => $q->where('mentor_id', $user->id))
            ->exists();

        return $mentored ? Response::allow() : Response::deny(self::FORBIDDEN);
    }

    private function ownedByIntern(User $user, LeaveRequest $leave): Response
    {
        return $leave->intern_id === $user->id ? Response::allow() : Response::deny(self::FORBIDDEN);
    }
}
