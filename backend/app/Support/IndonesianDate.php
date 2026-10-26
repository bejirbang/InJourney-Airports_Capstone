<?php

namespace App\Support;

use Carbon\CarbonInterface;

class IndonesianDate
{
    private const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    private const FULL_MONTHS = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    private const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    /**
     * "26 Oktober 2026", untuk dokumen resmi.
     */
    public static function long(CarbonInterface $date): string
    {
        return $date->day.' '.self::monthYear($date);
    }

    /**
     * "Oktober 2026".
     */
    public static function monthYear(CarbonInterface $date): string
    {
        return self::FULL_MONTHS[$date->month - 1].' '.$date->year;
    }

    public static function dayName(CarbonInterface $date): string
    {
        return self::DAYS[$date->dayOfWeek];
    }

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
