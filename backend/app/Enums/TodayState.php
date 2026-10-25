<?php

namespace App\Enums;

enum TodayState: string
{
    case NotClockedIn = 'not_clocked_in';
    case ClockedIn = 'clocked_in';
    case ClockedOut = 'clocked_out';
    // Sudah lewat jam pulang tanpa clock in: yang tersedia hanya Clock Out (hari itu tercatat Lupa Clock In).
    case MissedClockIn = 'missed_clock_in';
    case Holiday = 'holiday';
    case OnLeave = 'on_leave';
    case OutsidePeriod = 'outside_period';
}
