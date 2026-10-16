<?php

namespace App\Policies;

use App\Models\AttendanceCorrection;
use App\Models\User;

/**
 * Intern hanya melihat dan membatalkan permintaan koreksinya sendiri.
 */
class AttendanceCorrectionPolicy
{
    public function view(User $user, AttendanceCorrection $correction): bool
    {
        return $correction->intern_id === $user->id;
    }

    public function cancel(User $user, AttendanceCorrection $correction): bool
    {
        return $correction->intern_id === $user->id;
    }
}
