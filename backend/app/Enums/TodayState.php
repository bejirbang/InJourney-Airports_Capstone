<?php

namespace App\Enums;

/**
 * Kondisi kartu Hari Ini di dashboard intern (docs/design-intern.md, bagian 4.3).
 * Menentukan tombol: Clock In untuk `NotClockedIn`, Clock Out untuk `ClockedIn`, selain itu tanpa tombol.
 */
enum TodayState: string
{
    case NotClockedIn = 'not_clocked_in';
    case ClockedIn = 'clocked_in';
    case ClockedOut = 'clocked_out';
    case Holiday = 'holiday';
    case OnLeave = 'on_leave';
    case OutsidePeriod = 'outside_period';
}
