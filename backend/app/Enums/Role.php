<?php

namespace App\Enums;

enum Role: string
{
    case Intern = 'intern';
    case Mentor = 'mentor';
    case Admin = 'admin';

    /**
     * Label untuk log aktivitas dan jabatan bawaan akun baru. Tampilan lain memakai label dari frontend.
     */
    public function label(): string
    {
        return match ($this) {
            self::Intern => 'Intern',
            self::Mentor => 'Mentor',
            self::Admin => 'Admin',
        };
    }

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
