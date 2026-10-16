<?php

namespace App\Enums;

enum Role: string
{
    case Intern = 'intern';
    case Mentor = 'mentor';
    case Admin = 'admin';

    /**
     * Halaman pertama setelah login (alamat usulan di docs/design-*.md, bagian Menu sidebar).
     * Frontend membuka halaman ini, kecuali akun masih wajib ganti password.
     */
    public function homePath(): string
    {
        return match ($this) {
            self::Intern => '/intern/dashboard',
            self::Mentor => '/mentor/dashboard',
            self::Admin => '/admin/dashboard',
        };
    }
}
