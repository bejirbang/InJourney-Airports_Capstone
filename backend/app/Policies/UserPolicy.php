<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class UserPolicy
{
    public const CANNOT_RESET_SELF = 'Anda tidak bisa mereset password akun sendiri.';

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
}
