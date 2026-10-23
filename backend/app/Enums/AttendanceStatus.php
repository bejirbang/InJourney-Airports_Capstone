<?php

namespace App\Enums;

enum AttendanceStatus: string
{
    case Present = 'present';
    case Leave = 'leave';
    case Absent = 'absent';
    case MissedClockOut = 'missed_clock_out';
    case Holiday = 'holiday';
    case NotClockedIn = 'not_clocked_in';
    case Ongoing = 'ongoing';
}
