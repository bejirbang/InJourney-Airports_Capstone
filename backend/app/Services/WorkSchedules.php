<?php

namespace App\Services;

use App\Models\AirportSpecialSchedule;
use App\Models\AirportWeeklySchedule;
use App\Models\Holiday;
use App\Models\User;
use App\Support\DaySchedule;
use Illuminate\Support\Carbon;

/**
 * Menentukan jadwal kerja suatu tanggal untuk satu bandara, urut: hari libur, hari non-kerja
 * menurut jadwal mingguan, jadwal khusus, lalu jam jadwal mingguan. Tanggal sebelum jadwal mingguan
 * pertama berlaku dianggap bukan hari kerja.
 */
class WorkSchedules
{
    public function forIntern(User $intern, string $date): DaySchedule
    {
        return $this->betweenForIntern($intern, $date, $date)[$date];
    }

    /**
     * @return array<string, DaySchedule>
     */
    public function betweenForIntern(User $intern, string $from, string $to): array
    {
        $airportId = $intern->internProfile?->airport_id;

        if ($airportId === null) {
            return $this->eachDay($from, $to, fn (): DaySchedule => DaySchedule::off());
        }

        return $this->between($airportId, $from, $to);
    }

    public function forDate(int $airportId, string $date): DaySchedule
    {
        return $this->between($airportId, $date, $date)[$date];
    }

    /**
     * @return array<string, DaySchedule>
     */
    public function between(int $airportId, string $from, string $to): array
    {
        if ($from > $to) {
            return [];
        }

        $holidays = Holiday::query()
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->get()
            ->mapWithKeys(fn (Holiday $holiday): array => [$holiday->date->toDateString() => $holiday->name]);

        $weekly = AirportWeeklySchedule::query()
            ->where('airport_id', $airportId)
            ->whereDate('effective_from', '<=', $to)
            ->orderByDesc('effective_from')
            ->get();

        $specials = AirportSpecialSchedule::query()
            ->where('airport_id', $airportId)
            ->whereDate('start_date', '<=', $to)
            ->whereDate('end_date', '>=', $from)
            ->get();

        return $this->eachDay($from, $to, function (Carbon $date) use ($holidays, $weekly, $specials): DaySchedule {
            $day = $date->toDateString();

            if ($holidays->has($day)) {
                return DaySchedule::off($holidays->get($day));
            }

            $row = $weekly->first(fn (AirportWeeklySchedule $row): bool => $row->day_of_week === $date->isoWeekday()
                && $row->effective_from->toDateString() <= $day);

            if ($row === null || ! $row->is_workday) {
                return DaySchedule::off();
            }

            $special = $specials->first(fn (AirportSpecialSchedule $special): bool => $special->covers($day));

            return $special === null
                ? new DaySchedule(true, $row->start_time, $row->end_time)
                : new DaySchedule(true, $special->start_time, $special->end_time, specialName: $special->name);
        });
    }

    public function workingDays(User $intern, string $from, string $to): int
    {
        return count(array_filter(
            $this->betweenForIntern($intern, $from, $to),
            fn (DaySchedule $day): bool => $day->isWorkday,
        ));
    }

    /**
     * @param  callable(Carbon): DaySchedule  $resolve
     * @return array<string, DaySchedule>
     */
    private function eachDay(string $from, string $to, callable $resolve): array
    {
        $days = [];

        for ($date = Carbon::parse($from); $date->toDateString() <= $to; $date->addDay()) {
            $days[$date->toDateString()] = $resolve($date->copy());
        }

        return $days;
    }
}
