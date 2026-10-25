<?php

namespace App\Enums;

enum LeaveType: string
{
    case Sick = 'sick';
    case Urgent = 'urgent';

    public function label(): string
    {
        return match ($this) {
            self::Sick => 'Izin Sakit',
            self::Urgent => 'Izin Urgent',
        };
    }
}
