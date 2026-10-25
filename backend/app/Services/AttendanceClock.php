<?php

namespace App\Services;

use App\Enums\TodayState;
use App\Exceptions\ActionRejected;
use App\Models\Attendance;
use App\Models\Office;
use App\Models\User;
use App\Support\DaySchedule;
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

    public const ALREADY_CLOCKED_OUT = 'Anda sudah clock out hari ini.';

    public const AFTER_WORK_END = 'Jam pulang sudah lewat. Clock in tidak bisa dilakukan, gunakan Clock Out.';

    public const LOGBOOK_MISSING = 'Isi logbook dulu sebelum clock out.';

    public const CONFLICT = 'Presensi hari ini baru saja tercatat. Muat ulang halaman lalu coba lagi.';

    public function __construct(
        private AttendanceCalendar $calendar,
        private WorkSchedules $schedules,
        private SystemSettings $settings,
    ) {}

    /**
     * Hanya pada hari kerja, dalam periode magang, tanpa izin disetujui, dan sebelum jam pulang.
     *
     * @throws ActionRejected
     */
    public function clockIn(User $intern, float $latitude, float $longitude, CarbonInterface $now): Attendance
    {
        match ($this->calendar->today($intern, $now)['state']) {
            TodayState::OutsidePeriod => throw new ActionRejected(self::OUTSIDE_PERIOD, 'outside_period'),
            TodayState::Holiday => throw new ActionRejected(self::HOLIDAY, 'holiday'),
            TodayState::OnLeave => throw new ActionRejected(self::ON_LEAVE, 'on_leave'),
            TodayState::ClockedIn, TodayState::ClockedOut => throw new ActionRejected(self::ALREADY_CLOCKED_IN, 'already_clocked_in'),
            TodayState::MissedClockIn => throw new ActionRejected(self::AFTER_WORK_END, 'after_work_end'),
            TodayState::NotClockedIn => null,
        };

        $office = $this->officeFor($intern, $latitude, $longitude, clockIn: true);
        $schedule = $this->schedules->forIntern($intern, $now->toDateString());

        try {
            return $intern->attendances()->create([
                'date' => $now->toDateString(),
                'clock_in_at' => $now->format('H:i:s'),
                'clock_in_office_id' => $office->id,
                'clock_in_latitude' => $latitude,
                'clock_in_longitude' => $longitude,
                ...$this->scheduleCopy($schedule),
            ]);
        } catch (UniqueConstraintViolationException) {
            // Dua permintaan clock in hampir bersamaan: yang kedua ditolak oleh unique index.
            throw new ActionRejected(self::ALREADY_CLOCKED_IN, 'already_clocked_in');
        }
    }

    /**
     * Urutan pemeriksaan: jam pulang, logbook, lalu lokasi. Isian logbook boleh ikut dikirim; tanpa clock in
     * (Lupa Clock In) isian itu wajib karena baris presensi dan logbook dibuat bersamaan.
     *
     * @throws ActionRejected
     */
    public function clockOut(User $intern, float $latitude, float $longitude, ?string $work, ?string $notes, CarbonInterface $now): Attendance
    {
        try {
            return DB::transaction(function () use ($intern, $latitude, $longitude, $work, $notes, $now): Attendance {
                // Dikunci agar logbook tidak bisa diubah saat clock out sedang berjalan.
                $attendance = $intern->attendances()
                    ->whereDate('date', $now->toDateString())
                    ->lockForUpdate()
                    ->first();

                if ($attendance === null) {
                    return $this->clockOutWithoutClockIn($intern, $latitude, $longitude, $work, $notes, $now);
                }

                if ($attendance->clock_out_at !== null) {
                    throw new ActionRejected(self::ALREADY_CLOCKED_OUT, 'already_clocked_out');
                }

                $this->ensureWorkHoursOver($attendance->scheduled_end, $now);

                if ($work === null && ! $attendance->logbook()->exists()) {
                    throw new ActionRejected(self::LOGBOOK_MISSING, 'logbook_missing');
                }

                $office = $this->officeFor($intern, $latitude, $longitude, clockIn: false);

                $attendance->update([
                    'clock_out_at' => $now->format('H:i:s'),
                    'clock_out_office_id' => $office->id,
                    'clock_out_latitude' => $latitude,
                    'clock_out_longitude' => $longitude,
                ]);

                InternLogbooks::submitOnClockOut($attendance, $work, $notes, $now);

                return $attendance;
            });
        } catch (UniqueConstraintViolationException) {
            // Clock in dan clock out tanpa clock in dikirim hampir bersamaan.
            throw new ActionRejected(self::CONFLICT, 'conflict');
        }
    }

    /**
     * @throws ActionRejected
     */
    private function clockOutWithoutClockIn(User $intern, float $latitude, float $longitude, ?string $work, ?string $notes, CarbonInterface $now): Attendance
    {
        match ($this->calendar->today($intern, $now)['state']) {
            TodayState::OutsidePeriod => throw new ActionRejected(self::OUTSIDE_PERIOD, 'outside_period'),
            TodayState::Holiday => throw new ActionRejected(self::HOLIDAY, 'holiday'),
            TodayState::OnLeave => throw new ActionRejected(self::ON_LEAVE, 'on_leave'),
            default => null,
        };

        $schedule = $this->schedules->forIntern($intern, $now->toDateString());
        $this->ensureWorkHoursOver((string) $schedule->end, $now);

        if ($work === null) {
            throw new ActionRejected(self::LOGBOOK_MISSING, 'logbook_missing');
        }

        $office = $this->officeFor($intern, $latitude, $longitude, clockIn: false);

        $attendance = $intern->attendances()->create([
            'date' => $now->toDateString(),
            'clock_in_at' => null,
            'clock_out_at' => $now->format('H:i:s'),
            'clock_out_office_id' => $office->id,
            'clock_out_latitude' => $latitude,
            'clock_out_longitude' => $longitude,
            ...$this->scheduleCopy($schedule),
        ]);

        InternLogbooks::submitOnClockOut($attendance, $work, $notes, $now);

        return $attendance;
    }

    /**
     * Jadwal dan toleransi disalin agar perubahan pengaturan nanti tidak mengubah status hari ini.
     *
     * @return array{scheduled_start: string|null, scheduled_end: string|null, late_tolerance_minutes: int, is_corrected: false}
     */
    private function scheduleCopy(DaySchedule $schedule): array
    {
        return [
            'scheduled_start' => $schedule->start,
            'scheduled_end' => $schedule->end,
            'late_tolerance_minutes' => $this->settings->lateToleranceMinutes(),
            'is_corrected' => false,
        ];
    }

    /**
     * Menolak clock out sebelum jam pulang, dengan sisa waktu dibulatkan ke atas per menit
     * (16:59:30 menjadi "tunggu 1 menit lagi").
     *
     * @throws ActionRejected
     */
    private function ensureWorkHoursOver(string $workEnd, CarbonInterface $now): void
    {
        $end = $now->copy()->setTimeFromTimeString($workEnd);

        if ($now->lt($end)) {
            $minutesLeft = (int) ceil($now->diffInSeconds($end) / 60);

            throw new ActionRejected(
                'Belum saatnya clock out, tunggu '.Duration::minutes($minutesLeft).' lagi.',
                'before_work_end',
            );
        }
    }

    /**
     * Hanya titik presensi aktif milik bandara intern. Jika posisi masuk radius beberapa titik,
     * yang dicatat titik terdekat.
     *
     * @throws ActionRejected
     */
    private function officeFor(User $intern, float $latitude, float $longitude, bool $clockIn): Office
    {
        $action = $clockIn ? 'Clock in' : 'Clock out';
        $offices = Office::query()->active()->where('airport_id', $intern->internProfile?->airport_id)->get();

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
