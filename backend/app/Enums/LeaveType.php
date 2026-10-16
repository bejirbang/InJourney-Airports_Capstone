<?php

namespace App\Enums;

enum LeaveType: string
{
    case Sick = 'sick';
    case Urgent = 'urgent';

    /**
     * Label untuk teks notifikasi yang dibuat backend. Tampilan lain memakai label dari frontend.
     */
    public function label(): string
    {
        return match ($this) {
            self::Sick => 'Izin Sakit',
            self::Urgent => 'Izin Urgent',
        };
    }
}
