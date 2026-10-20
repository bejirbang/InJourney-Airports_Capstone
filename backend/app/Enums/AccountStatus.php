<?php

namespace App\Enums;

/**
 * Status akun di daftar Pengguna (docs/design-admin.md 4.1). Dihitung saat dibaca dari
 * `is_active` dan periode magang (AccountAccess), tidak disimpan.
 * `NotStarted` = intern aktif yang periode magangnya belum dimulai ("Belum dimulai").
 */
enum AccountStatus: string
{
    case Active = 'active';
    case NotStarted = 'not_started';
    case Inactive = 'inactive';
}
