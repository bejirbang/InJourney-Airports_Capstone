<?php

namespace App\Enums;

enum Role: string
{
    case Intern = 'intern';
    case Mentor = 'mentor';
    case Admin = 'admin';

    public function label(): string
    {
        return match ($this) {
            self::Intern => 'Intern',
            self::Mentor => 'Mentor',
            self::Admin => 'Admin',
        };
    }

    public function homePath(): string
    {
        return match ($this) {
            self::Intern => '/intern/dashboard',
            self::Mentor => '/mentor/dashboard',
            self::Admin => '/admin/dashboard',
        };
    }
}
