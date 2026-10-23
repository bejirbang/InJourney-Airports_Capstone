<?php

namespace App\Policies;

use App\Models\AttendanceCorrection;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class AttendanceCorrectionPolicy
{
    public const FORBIDDEN = 'Anda tidak memiliki akses ke permintaan koreksi ini.';

    public function view(User $user, AttendanceCorrection $correction): Response
    {
        return $this->ownedByIntern($user, $correction);
    }

    public function cancel(User $user, AttendanceCorrection $correction): Response
    {
        return $this->ownedByIntern($user, $correction);
    }

    private function ownedByIntern(User $user, AttendanceCorrection $correction): Response
    {
        return $correction->intern_id === $user->id ? Response::allow() : Response::deny(self::FORBIDDEN);
    }
}
