<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Date;

/**
 * Menentukan apakah sebuah akun boleh memakai sistem.
 * Dipakai saat login dan pada setiap request yang sudah login.
 */
class AccountAccess
{
    public const INACTIVE = 'Akun Anda tidak aktif. Hubungi admin.';

    public const NOT_STARTED = 'Masa magang Anda belum dimulai.';

    /**
     * Alasan penolakan, atau null jika akun boleh masuk.
     */
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

        // Nonaktif otomatis mulai hari setelah tanggal selesai magang.
        if ($today > $profile->end_date->toDateString()) {
            return self::INACTIVE;
        }

        return null;
    }
}
