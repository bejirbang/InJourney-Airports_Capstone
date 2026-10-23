<?php

namespace App\Support;

use Carbon\CarbonInterface;

/**
 * Format tanggal pendek untuk teks notifikasi, sama dengan formatShort dan formatRange di frontend/src/lib/mock-rules.ts.
 */
class IndonesianDate
{
    private const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    /**
     * "9 Okt".
     */
    public static function short(CarbonInterface $date): string
    {
        return $date->day.' '.self::MONTHS[$date->month - 1];
    }

    /**
     * "17 Okt 2026", sama dengan formatShort(d, true) di mock-rules.ts.
     */
    public static function withYear(CarbonInterface $date): string
    {
        return self::short($date).' '.$date->year;
    }

    /**
     * "13 Okt", "13-14 Okt", atau "30 Sep - 2 Okt", sama dengan formatRange di mock-rules.ts.
     */
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
