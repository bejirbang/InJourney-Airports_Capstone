<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Enums\CorrectionStatus;
use App\Exceptions\ActionRejected;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\User;
use App\Support\IndonesianDate;
use Carbon\CarbonInterface;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Validation\ValidationException;

/**
 * Pengajuan koreksi oleh intern (tanggal + alasan, tanpa bukti) dan aturan yang dipakai ketiga role.
 */
class AttendanceCorrections
{
    public const DATE_NOT_ALLOWED = 'Pilih hari kerja yang sudah lewat, dalam periode magang.';

    public const NOT_CORRECTABLE = 'Presensi tanggal ini tidak perlu dikoreksi.';

    public const ACTIVE_EXISTS = 'Sudah ada pengajuan koreksi untuk tanggal ini.';

    public const ALREADY_CANCELLED = 'Pengajuan ini sudah dibatalkan.';

    public const CANCELLED_BY_INTERN = 'Pengajuan ini sudah dibatalkan intern.';

    public function __construct(private AttendanceCalendar $calendar, private Notifier $notifier) {}

    /**
     * Status hari itu disimpan sebagai data tercatat. Pengajuan sah jika status bukan Hadir atau bertanda
     * Lupa Clock Out.
     *
     * @throws ValidationException
     */
    public function submit(User $intern, string $date, string $reason, CarbonInterface $now): AttendanceCorrection
    {
        $today = $now->toDateString();
        $day = $date < $today ? ($this->calendar->days($intern, $date, $date, $now)[$date] ?? null) : null;

        if ($day === null || $day['status'] === AttendanceStatus::Holiday) {
            throw ValidationException::withMessages(['date' => self::DATE_NOT_ALLOWED]);
        }

        if (! AttendanceHistory::correctable($date, $day, $today)) {
            throw ValidationException::withMessages(['date' => self::NOT_CORRECTABLE]);
        }

        if ($intern->attendanceCorrections()->active()->whereDate('date', $date)->exists()) {
            throw ValidationException::withMessages(['date' => self::ACTIVE_EXISTS]);
        }

        try {
            $correction = $intern->attendanceCorrections()->create([
                'mentor_id' => $intern->internProfile?->mentor_id,
                'date' => $date,
                'recorded_status' => $day['status'],
                'recorded_missed_clock_out' => $day['missed_clock_out'],
                'reason' => $reason,
                'status' => CorrectionStatus::PendingMentor,
            ]);
        } catch (UniqueConstraintViolationException) {
            // Dua pengajuan hampir bersamaan: unique index parsial menolak yang kedua.
            throw ValidationException::withMessages(['date' => self::ACTIVE_EXISTS]);
        }

        if ($correction->mentor_id !== null) {
            $this->notifier->send(
                [$correction->mentor_id],
                "{$intern->shortName()} mengajukan koreksi presensi ".IndonesianDate::short($correction->date).'.',
                '/koreksi',
                ['open' => $correction->id],
            );
        }

        return $correction;
    }

    /**
     * Boleh selama menunggu mentor atau admin. Update bersyarat agar tidak bertabrakan dengan keputusan
     * yang diambil bersamaan.
     *
     * @throws ActionRejected
     */
    public function cancel(AttendanceCorrection $correction): AttendanceCorrection
    {
        $updated = AttendanceCorrection::query()
            ->whereKey($correction->id)
            ->active()
            ->update(['status' => CorrectionStatus::Cancelled]);

        $correction->refresh();

        if ($updated === 0) {
            throw $correction->status === CorrectionStatus::Cancelled
                ? new ActionRejected(self::ALREADY_CANCELLED, 'already_cancelled')
                : self::alreadyProcessed($correction);
        }

        return $correction;
    }

    /**
     * Mengunci pengajuan dan memastikan statusnya masih yang diharapkan. $check boleh menolak lebih dulu
     * dengan pesan yang lebih spesifik.
     *
     * @param  (callable(AttendanceCorrection): void)|null  $check
     *
     * @throws ActionRejected
     */
    public static function lock(AttendanceCorrection $correction, CorrectionStatus $expected, ?callable $check = null): AttendanceCorrection
    {
        $correction = AttendanceCorrection::query()->with('intern')->lockForUpdate()->findOrFail($correction->id);

        if ($check !== null) {
            $check($correction);
        }

        if ($correction->status === CorrectionStatus::Cancelled) {
            throw new ActionRejected(self::CANCELLED_BY_INTERN, 'cancelled');
        }

        if ($correction->status !== $expected) {
            throw self::alreadyProcessed($correction);
        }

        return $correction;
    }

    public static function alreadyProcessed(AttendanceCorrection $correction): ActionRejected
    {
        $decider = $correction->admin_id !== null ? $correction->admin : $correction->mentor;

        return new ActionRejected('Data ini sudah diproses oleh '.($decider->name ?? 'pihak lain').'.', 'already_processed');
    }

    /**
     * Jam tercatat saat ini pada tanggal pengajuan.
     *
     * @return array{clock_in_at: string|null, clock_out_at: string|null}
     */
    public static function recorded(?Attendance $attendance): array
    {
        return [
            'clock_in_at' => self::time($attendance?->clock_in_at),
            'clock_out_at' => self::time($attendance?->clock_out_at),
        ];
    }

    public static function attendanceOf(AttendanceCorrection $correction): ?Attendance
    {
        return Attendance::query()
            ->where('intern_id', $correction->intern_id)
            ->whereDate('date', $correction->date->toDateString())
            ->first();
    }

    public static function time(?string $time): ?string
    {
        return $time === null ? null : substr($time, 0, 5);
    }
}
