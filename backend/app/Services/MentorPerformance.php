<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Enums\LogbookReviewAction;
use App\Enums\LogbookStatus;
use App\Models\LogbookReview;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * Performa intern untuk pemantauan (bukan nilai). Rekap memakai hari kerja final. KPI (design-mentor 10.2):
 * Kehadiran = (Hadir + Terlambat + Lupa Clock In) / (hari kerja - Izin); Tepat waktu = Hadir / (Hadir + Terlambat);
 * Logbook disetujui = logbook disetujui / hari wajib berlogbook; Revisi logbook = jumlah permintaan revisi.
 * Setiap angka disertai daftar tanggalnya agar bisa diklik.
 *
 * @phpstan-import-type CalendarDay from AttendanceCalendar
 */
class MentorPerformance
{
    public const MIN_KPI_DAYS = 5;

    public function __construct(private AttendanceCalendar $calendar, private AccountAccess $access) {}

    /**
     * @return array<string, mixed>
     */
    public function month(User $mentor, string $month, ?int $internId, CarbonInterface $now): array
    {
        $mentees = User::query()
            ->with('internProfile')
            ->whereHas('internProfile', fn (Builder $q) => $q->where('mentor_id', $mentor->id))
            ->orderBy('name')
            ->get();

        [$from, $to] = AttendanceCalendar::monthRange($month);

        $rows = $mentees
            ->when($internId !== null, fn ($c) => $c->where('id', $internId))
            ->map(fn (User $intern): array => $this->internRow($intern, $month, $from, $to, $now))
            ->filter(fn (array $row): bool => $row['recap']['working_days'] > 0)
            ->values();

        $enough = $rows->where('kpi.enough_data', true);
        $average = function (string $key) use ($enough): ?int {
            $values = $enough->pluck("kpi.{$key}")->filter(fn ($v): bool => $v !== null);

            return $values->isEmpty() ? null : (int) round($values->avg());
        };

        $firstMonth = $mentees->min(fn (User $i): ?string => $i->internProfile?->start_date->format('Y-m'));

        return [
            'month' => $month,
            'selectable_months' => $firstMonth === null ? null : ['first' => $firstMonth, 'last' => $now->format('Y-m')],
            'interns_total' => $mentees->count(),
            'summary' => [
                'attendance_rate' => $average('attendance_rate'),
                'on_time_rate' => $average('on_time_rate'),
                'logbook_approved_rate' => $average('logbook_approved_rate'),
            ],
            'interns' => $rows->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function internRow(User $intern, string $month, string $from, string $to, CarbonInterface $now): array
    {
        $days = $this->calendar->days($intern, $from, $to, $now);
        $recap = $this->calendar->recap($days, $month, $now);
        $today = $now->toDateString();
        $final = array_filter($days, fn (array $day, string $date): bool => $date < $today && $day['status'] !== AttendanceStatus::Holiday, ARRAY_FILTER_USE_BOTH);

        // Hari wajib berlogbook: setiap baris presensi di bulan ini dalam periode magang (sampai hari ini).
        $required = array_filter($days, fn (array $day): bool => $day['attendance'] !== null);
        $approved = array_filter($required, fn (array $day): bool => $day['attendance']->logbook?->status === LogbookStatus::Approved);
        $revisionDates = $this->revisionDates($intern, $from, $to);

        $attended = $recap['present'] + $recap['late'] + $recap['missed_clock_in'];

        return [
            'intern' => ['id' => $intern->id, 'name' => $intern->name, 'short_name' => $intern->shortName()],
            'is_active' => $this->access->denialReason($intern, $now) === null,
            'recap' => [
                'present' => $recap['present'],
                'late' => $recap['late'],
                'missed_clock_in' => $recap['missed_clock_in'],
                'missed_clock_out' => $recap['missed_clock_out'],
                'leave' => $recap['leave'],
                'absent' => $recap['absent'],
                'working_days' => $recap['working_days'],
            ],
            'kpi' => [
                'enough_data' => $recap['working_days'] >= self::MIN_KPI_DAYS,
                'attendance_rate' => self::percent($attended, $recap['working_days'] - $recap['leave']),
                'on_time_rate' => self::percent($recap['present'], $recap['present'] + $recap['late']),
                'logbook_approved_rate' => self::percent(count($approved), count($required)),
                'logbook_revisions' => count($revisionDates),
            ],
            'dates' => [
                'present' => self::datesWhere($final, fn (array $day): bool => $day['status'] === AttendanceStatus::Present),
                'late' => self::datesWhere($final, fn (array $day): bool => $day['status'] === AttendanceStatus::Late),
                'missed_clock_in' => self::datesWhere($final, fn (array $day): bool => $day['status'] === AttendanceStatus::MissedClockIn),
                'missed_clock_out' => self::datesWhere($final, fn (array $day): bool => $day['missed_clock_out']),
                'leave' => self::datesWhere($final, fn (array $day): bool => $day['status'] === AttendanceStatus::Leave),
                'absent' => self::datesWhere($final, fn (array $day): bool => $day['status'] === AttendanceStatus::Absent),
                'logbook_not_approved' => array_values(array_diff(array_keys($required), array_keys($approved))),
                'logbook_revisions' => $revisionDates,
            ],
        ];
    }

    /**
     * Tanggal logbook untuk setiap permintaan revisi di bulan itu (satu tanggal bisa muncul lebih dari sekali).
     *
     * @return list<string>
     */
    private function revisionDates(User $intern, string $from, string $to): array
    {
        return array_values(LogbookReview::query()
            ->where('action', LogbookReviewAction::Revision)
            ->whereHas('logbook.attendance', fn (Builder $q) => $q
                ->where('intern_id', $intern->id)
                ->whereDate('date', '>=', $from)
                ->whereDate('date', '<=', $to))
            ->with('logbook.attendance:id,date')
            ->orderBy('id')
            ->get()
            ->map(fn (LogbookReview $review): string => $review->logbook->attendance->date->toDateString())
            ->sort()
            ->all());
    }

    /**
     * @param  array<string, CalendarDay>  $days
     * @param  callable(CalendarDay): bool  $match
     * @return list<string>
     */
    private static function datesWhere(array $days, callable $match): array
    {
        return array_keys(array_filter($days, $match));
    }

    private static function percent(int $numerator, int $denominator): ?int
    {
        return $denominator > 0 ? (int) round($numerator / $denominator * 100) : null;
    }
}
