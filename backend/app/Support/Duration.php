<?php

namespace App\Support;

class Duration
{
    public static function minutes(int $minutes): string
    {
        $hours = intdiv($minutes, 60);
        $rest = $minutes % 60;

        return match (true) {
            $hours === 0 => "{$rest} menit",
            $rest === 0 => "{$hours} jam",
            default => "{$hours} jam {$rest} menit",
        };
    }
}
