<?php

namespace App\Support;

use Carbon\CarbonInterface;

class IndonesianDate
{
    private const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    public static function short(CarbonInterface $date): string
    {
        return $date->day.' '.self::MONTHS[$date->month - 1];
    }

    public static function withYear(CarbonInterface $date): string
    {
        return self::short($date).' '.$date->year;
    }

    public static function range(CarbonInterface $start, CarbonInterface $end): string
    {
        if ($start->isSameDay($end)) {
            return self::short($start);
        }

        if ($start->format('Y-m') === $end->format('Y-m')) {
            return $start->day.'-'.self::short($end);
        }

        return self::short($start).' - '.self::short($end);
    }
}
