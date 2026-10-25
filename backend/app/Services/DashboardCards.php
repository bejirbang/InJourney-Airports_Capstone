<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * Kartu presensi Dashboard admin dan mentor. Setiap kotak bisa diklik, jadi baris nama ikut dikirim. Intern yang
 * hari itu libur menurut jadwal bandaranya tidak dihitung.
 *
 * @phpstan-import-type StatusDay from AttendanceCalendar
 */
class DashboardCards
{
    public const LOOKBACK_DAYS = 14;

    public function __construct(private AttendanceCalendar $calendar) {}

    /**
     * Hari ini memakai "Belum Clock In" karena status belum final. `holiday` terisi jika semua intern libur.
     *
     * @param  iterable<User>  $interns
     * @return array{holiday: array{name: string|null}|null, card: array<string, mixed>|null}
     */
    public function today(iterable $interns, CarbonInterface $now): array
    {
        $days = $this->calendar->statusesOn($interns, $now->toDateString(), $now);
        $working = array_filter($days, fn (array $day): bool => $day['status'] !== AttendanceStatus::Holiday);

        if ($days !== [] && $working === []) {
            $name = null;

            foreach ($days as $day) {
                $name ??= $day['schedule']->holidayName;
            }

            return ['holiday' => ['name' => $name], 'card' => null];
        }

        $count = fn (callable $match): int => count(array_filter($working, $match));

        return ['holiday' => null, 'card' => [
            'interns' => count($working),
            'clocked_in' => $count(fn (array $day): bool => $day['status']->isAttended()),
            'late' => $count(fn (array $day): bool => $day['status'] === AttendanceStatus::Late),
            'on_leave' => $count(fn (array $day): bool => $day['status'] === AttendanceStatus::Leave),
            'not_clocked_in' => $count(fn (array $day): bool => $day['status'] === AttendanceStatus::NotClockedIn),
            'rows' => self::rows($working),
        ]];
    }

    /**
     * Ringkasan hari kerja terakhir sebelum hari ini (status final). Null jika tidak ada dalam 14 hari terakhir.
     *
     * @param  iterable<User>  $interns
     * @return array<string, mixed>|null
     */
    public function previousDay(iterable $interns, CarbonInterface $now): ?array
    {
        $interns = is_array($interns) ? $interns : iterator_to_array($interns);

        for ($i = 1; $i <= self::LOOKBACK_DAYS; $i++) {
            $date = Carbon::parse($now->toDateString())->subDays($i)->toDateString();
            $working = array_filter(
                $this->calendar->statusesOn($interns, $date, $now),
                fn (array $day): bool => $day['status'] !== AttendanceStatus::Holiday,
            );

            if ($working === []) {
                continue;
            }

            $status = fn (AttendanceStatus $status): int => count(array_filter($working, fn (array $day): bool => $day['status'] === $status));

            return [
                'date' => $date,
                'present' => $status(AttendanceStatus::Present),
                'late' => $status(AttendanceStatus::Late),
                'missed_clock_in' => $status(AttendanceStatus::MissedClockIn),
                'leave' => $status(AttendanceStatus::Leave),
                'absent' => $status(AttendanceStatus::Absent),
                'missed_clock_out' => count(array_filter($working, fn (array $day): bool => $day['missed_clock_out'])),
                'rows' => self::rows($working),
            ];
        }

        return null;
    }

    /**
     * @param  array<int, StatusDay>  $days
     * @return list<array<string, mixed>>
     */
    private static function rows(array $days): array
    {
        $rows = array_map(AttendanceCalendar::dayRow(...), array_values($days));
        usort($rows, fn (array $a, array $b): int => [$a['intern']['name'], $a['intern']['id']] <=> [$b['intern']['name'], $b['intern']['id']]);

        return $rows;
    }
}
