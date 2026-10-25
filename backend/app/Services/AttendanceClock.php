<?php

namespace App\Services;

use App\Enums\TodayState;
use App\Exceptions\ActionRejected;
use App\Models\Attendance;
use App\Models\Office;
use App\Models\User;
use App\Models\WorkHourSetting;
use App\Support\Duration;
use Carbon\CarbonInterface;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class AttendanceClock
{
    public const OUTSIDE_PERIOD = 'Di luar periode magang.';

    public const HOLIDAY = 'Hari ini libur.';

    public const ON_LEAVE = 'Anda sedang izin hari ini.';

    public const ALREADY_CLOCKED_IN = 'Anda sudah clock in hari ini.';

    public const NOT_CLOCKED_IN = 'Anda belum clock in hari ini.';

    public const ALREADY_CLOCKED_OUT = 'Anda sudah clock out hari ini.';

    public const DAILY_REPORT_MISSING = 'Daily Report belum dikirim. Isi dulu sebelum clock out.';

    public function __construct(private AttendanceCalendar $calendar) {}

    /**
     * @throws ActionRejected
     */
    public function clockIn(User $intern, float $latitude, float $longitude, CarbonInterface $now): Attendance
    {
        match ($this->calendar->today($intern, $now)['state']) {
            TodayState::OutsidePeriod => throw new ActionRejected(self::OUTSIDE_PERIOD, 'outside_period'),
            TodayState::Holiday => throw new ActionRejected(self::HOLIDAY, 'holiday'),
            TodayState::OnLeave => throw new ActionRejected(self::ON_LEAVE, 'on_leave'),
            TodayState::ClockedIn, TodayState::ClockedOut => throw new ActionRejected(self::ALREADY_CLOCKED_IN, 'already_clocked_in'),
            TodayState::NotClockedIn => null,
        };

        $office = $this->officeFor($latitude, $longitude, clockIn: true);

        try {
            return $intern->attendances()->create([
                'date' => $now->toDateString(),
                'clock_in_at' => $now->format('H:i:s'),
                'clock_in_office_id' => $office->id,
                'clock_in_latitude' => $latitude,
                'clock_in_longitude' => $longitude,
                'is_corrected' => false,
            ]);
        } catch (UniqueConstraintViolationException) {
            // Dua permintaan clock in hampir bersamaan: yang kedua ditolak oleh unique index.
            throw new ActionRejected(self::ALREADY_CLOCKED_IN, 'already_clocked_in');
        }
    }

    /**
     * @throws ActionRejected
     */
    public function clockOut(User $intern, float $latitude, float $longitude, CarbonInterface $now): Attendance
    {
        return DB::transaction(function () use ($intern, $latitude, $longitude, $now): Attendance {
            // Dikunci agar Daily Report tidak bisa diubah saat clock out sedang berjalan.
            $attendance = $intern->attendances()
                ->whereDate('date', $now->toDateString())
                ->lockForUpdate()
                ->first();

            if ($attendance === null) {
                throw new ActionRejected(self::NOT_CLOCKED_IN, 'not_clocked_in');
            }

            if ($attendance->clock_out_at !== null) {
                throw new ActionRejected(self::ALREADY_CLOCKED_OUT, 'already_clocked_out');
            }

            if (! $attendance->dailyReport()->exists()) {
                throw new ActionRejected(self::DAILY_REPORT_MISSING, 'daily_report_missing');
            }

            $this->ensureWorkHoursOver($now);

            $office = $this->officeFor($latitude, $longitude, clockIn: false);

            $attendance->update([
                'clock_out_at' => $now->format('H:i:s'),
                'clock_out_office_id' => $office->id,
                'clock_out_latitude' => $latitude,
                'clock_out_longitude' => $longitude,
            ]);

            return $attendance;
        });
    }

    /**
     * Menolak clock out sebelum jam pulang, dengan sisa waktu dibulatkan ke atas per menit
     * (16:59:30 menjadi "tunggu 1 menit lagi").
     *
     * @throws ActionRejected
     */
    private function ensureWorkHoursOver(CarbonInterface $now): void
    {
        $hours = WorkHourSetting::effectiveOn($now->toDateString());

        if ($hours === null) {
            return;
        }

        $workEnd = $now->copy()->setTimeFromTimeString($hours->end_time);

        if ($now->lt($workEnd)) {
            $minutesLeft = (int) ceil($now->diffInSeconds($workEnd) / 60);

            throw new ActionRejected(
                'Belum saatnya clock out, tunggu '.Duration::minutes($minutesLeft).' lagi.',
                'before_work_end',
            );
        }
    }

    /**
     * Jika posisi masuk radius beberapa kantor, yang dicatat kantor terdekat.
     *
     * @throws ActionRejected
     */
    private function officeFor(float $latitude, float $longitude, bool $clockIn): Office
    {
        $action = $clockIn ? 'Clock in' : 'Clock out';
        $offices = Office::query()->active()->get();

        if ($offices->isEmpty()) {
            throw new ActionRejected("Belum ada kantor aktif. {$action} belum bisa dilakukan. Hubungi admin.", 'no_active_office');
        }

        $office = $offices
            ->map(fn (Office $office): array => [$office, $office->distanceTo($latitude, $longitude)])
            ->filter(fn (array $pair): bool => $pair[1] <= ($clockIn
                ? $pair[0]->clock_in_radius_meters
                : $pair[0]->clock_out_radius_meters))
            ->sortBy(fn (array $pair): float => $pair[1])
            ->first();

        if ($office === null) {
            throw new ActionRejected("Lokasi Anda belum sesuai. {$action} belum bisa dilakukan.", 'outside_radius');
        }

        return $office[0];
    }
}
