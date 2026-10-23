<?php

namespace App\Enums;

enum TodayState: string
{
    case NotClockedIn = 'not_clocked_in';
    case ClockedIn = 'clocked_in';
    case ClockedOut = 'clocked_out';
    case Holiday = 'holiday';
    case OnLeave = 'on_leave';
    case OutsidePeriod = 'outside_period';
}
