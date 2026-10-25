<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Enums\RequestStatus;
use App\Enums\Role;
use App\Exceptions\ActionRejected;
use App\Models\AttendanceCorrection;
use App\Models\User;
use App\Support\IndonesianDate;
use Carbon\CarbonInterface;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AttendanceCorrections
{
    public const DATE_NOT_ALLOWED = 'Pilih hari kerja yang sudah lewat atau hari ini, dalam periode magang.';

    public const PENDING_EXISTS = 'Sudah ada permintaan koreksi untuk tanggal ini.';

    public const ALREADY_CANCELLED = 'Permintaan ini sudah dibatalkan.';

    public function __construct(private AttendanceCalendar $calendar, private Notifier $notifier) {}

    /**
     * @param  array{date: string, clock_in: string, clock_out: string, reason: string}  $input
     *
     * @throws ValidationException
     */
    public function submit(User $intern, array $input, ?UploadedFile $evidence, CarbonInterface $now): AttendanceCorrection
    {
        $date = $input['date'];
        $day = $this->calendar->days($intern, $date, $date, $now)[$date] ?? null;

        if ($day === null || $day['status'] === AttendanceStatus::Holiday) {
            throw ValidationException::withMessages(['date' => self::DATE_NOT_ALLOWED]);
        }

        if ($intern->attendanceCorrections()->where('status', RequestStatus::Pending)->whereDate('date', $date)->exists()) {
            throw ValidationException::withMessages(['date' => self::PENDING_EXISTS]);
        }

        $path = $evidence?->store("attendance-corrections/{$intern->id}");

        try {
            $correction = DB::transaction(function () use ($intern, $input, $day, $path): AttendanceCorrection {
                $correction = $intern->attendanceCorrections()->create([
                    'date' => $input['date'],
                    'recorded_clock_in' => $day['attendance']?->clock_in_at,
                    'recorded_clock_out' => $day['attendance']?->clock_out_at,
                    'requested_clock_in' => $input['clock_in'].':00',
                    'requested_clock_out' => $input['clock_out'].':00',
                    'reason' => $input['reason'],
                    'evidence_path' => $path === false ? null : $path,
                    'status' => RequestStatus::Pending,
                ]);

                $this->notifyAdmins($intern, $correction);

                return $correction;
            });
        } catch (UniqueConstraintViolationException) {
            // Dua pengajuan hampir bersamaan: unique index parsial menolak yang kedua.
            if (is_string($path)) {
                Storage::delete($path);
            }

            throw ValidationException::withMessages(['date' => self::PENDING_EXISTS]);
        }

        return $correction;
    }

    /**
     * @throws ActionRejected
     */
    public function cancel(AttendanceCorrection $correction): AttendanceCorrection
    {
        // Update bersyarat agar tidak bertabrakan dengan admin yang sedang memutuskan.
        $updated = AttendanceCorrection::query()
            ->whereKey($correction->id)
            ->where('status', RequestStatus::Pending)
            ->update(['status' => RequestStatus::Cancelled]);

        $correction->refresh()->load('decider:id,name');

        if ($updated === 0) {
            throw $correction->status === RequestStatus::Cancelled
                ? new ActionRejected(self::ALREADY_CANCELLED, 'already_cancelled')
                : new ActionRejected(
                    'Data ini sudah diproses oleh '.($correction->decider->name ?? 'admin').'.',
                    'already_processed',
                );
        }

        return $correction;
    }

    private function notifyAdmins(User $intern, AttendanceCorrection $correction): void
    {
        $this->notifier->send(
            User::query()->where('role', Role::Admin)->where('is_active', true)->pluck('id')->all(),
            $intern->shortName().' mengajukan koreksi absensi '.IndonesianDate::short($correction->date).'.',
            '/koreksi',
            ['open' => $correction->id],
        );
    }
}
