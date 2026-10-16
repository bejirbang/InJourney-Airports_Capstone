<?php

namespace App\Policies;

use App\Models\LeaveRequest;
use App\Models\User;

/**
 * Intern hanya melihat dan membatalkan izinnya sendiri.
 */
class LeaveRequestPolicy
{
    public function view(User $user, LeaveRequest $leave): bool
    {
        return $leave->intern_id === $user->id;
    }

    public function cancel(User $user, LeaveRequest $leave): bool
    {
        return $leave->intern_id === $user->id;
    }
}
