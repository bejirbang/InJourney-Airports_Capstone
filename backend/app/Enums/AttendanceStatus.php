<?php

namespace App\Enums;

/**
 * Lupa Clock Out dan Dikoreksi bukan status, melainkan tanda tambahan pada hari Hadir atau Terlambat.
 */
enum AttendanceStatus: string
{
    case Present = 'present';
    case Late = 'late';
    case MissedClockIn = 'missed_clock_in';
    case Leave = 'leave';
    case Absent = 'absent';
    case Holiday = 'holiday';
    case NotClockedIn = 'not_clocked_in';

    /**
     * Hari dengan baris presensi dihitung hadir di rekap.
     */
    public function isAttended(): bool
    {
        return in_array($this, [self::Present, self::Late, self::MissedClockIn], true);
    }
}
