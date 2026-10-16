<?php

namespace App\Enums;

/**
 * Status kehadiran satu tanggal. Dihitung, tidak disimpan (lihat App\Services\AttendanceCalendar).
 * `Ongoing` dan `NotClockedIn` hanya untuk hari berjalan; statusnya belum final sampai lewat 23:59.
 */
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
