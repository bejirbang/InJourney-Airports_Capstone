<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Announcement;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Intern dan mentor hanya membuka pengumuman untuk role-nya (design-intern.md 16, design-mentor.md 14).
 * Admin melihat semua.
 */
class AnnouncementPolicy
{
    public const FORBIDDEN = 'Anda tidak memiliki akses ke pengumuman ini.';

    public function view(User $user, Announcement $announcement): Response
    {
        $allowed = match ($user->role) {
            Role::Admin => true,
            Role::Intern => $announcement->for_intern,
            Role::Mentor => $announcement->for_mentor,
        };

        return $allowed ? Response::allow() : Response::deny(self::FORBIDDEN);
    }
}
