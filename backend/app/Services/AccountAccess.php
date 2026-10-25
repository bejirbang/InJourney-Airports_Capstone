<?php

namespace App\Services;

use App\Enums\AccountStatus;
use App\Enums\Role;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Date;

class AccountAccess
{
    public const INACTIVE = 'Akun Anda tidak aktif. Hubungi admin.';

    public const NOT_STARTED = 'Masa magang Anda belum dimulai.';

    public function denialReason(User $user, ?CarbonInterface $today = null): ?string
    {
        if (! $user->is_active) {
            return self::INACTIVE;
        }

        if (! $user->hasRole(Role::Intern)) {
            return null;
        }

        $profile = $user->internProfile;

        if ($profile === null) {
            return self::INACTIVE;
        }

        $today = ($today ?? Date::now())->toDateString();

        if ($today < $profile->start_date->toDateString()) {
            return self::NOT_STARTED;
        }

        if ($today > $profile->end_date->toDateString()) {
            return self::INACTIVE;
        }

        return null;
    }

    public function status(User $user, ?CarbonInterface $today = null): AccountStatus
    {
        return match ($this->denialReason($user, $today)) {
            null => AccountStatus::Active,
            self::NOT_STARTED => AccountStatus::NotStarted,
            default => AccountStatus::Inactive,
        };
    }
}
