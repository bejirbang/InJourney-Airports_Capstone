<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\User;
use App\Services\MentorInterns;
use Illuminate\Auth\Access\Response;

class UserPolicy
{
    public const CANNOT_RESET_SELF = 'Anda tidak bisa mereset password akun sendiri.';

    public const INTERN_FORBIDDEN = 'Anda tidak memiliki akses ke intern ini.';

    /**
     * Hanya admin, dan bukan untuk akunnya sendiri (reset dilakukan admin lain).
     */
    public function resetPassword(User $actor, User $target): Response
    {
        if (! $actor->hasRole(Role::Admin)) {
            return Response::deny('Anda tidak memiliki akses.');
        }

        if ($actor->is($target)) {
            return Response::deny(self::CANNOT_RESET_SELF);
        }

        return Response::allow();
    }

    /**
     * Mentor membuka Intern Saya: intern bimbingan saat ini atau yang pernah dibimbing (design-mentor.md Alur 3).
     */
    public function viewAsMentor(User $mentor, User $intern): Response
    {
        return app(MentorInterns::class)->relation($mentor, $intern) === null
            ? Response::deny(self::INTERN_FORBIDDEN)
            : Response::allow();
    }
}
