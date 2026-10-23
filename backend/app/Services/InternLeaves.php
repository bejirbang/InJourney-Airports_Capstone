<?php

namespace App\Services;

use App\Enums\LeaveType;
use App\Enums\RequestStatus;
use App\Exceptions\ActionRejected;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Support\IndonesianDate;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

class InternLeaves
{
    public const OUTSIDE_PERIOD = 'Tanggal di luar periode magang.';

    public const NO_WORKING_DAY = 'Tanggal yang dipilih tidak mengandung hari kerja.';

    public const OVERLAP = 'Sudah ada izin pada tanggal ini.';

    public const ALREADY_CANCELLED = 'Pengajuan izin ini sudah dibatalkan.';

    public function __construct(private AttendanceCalendar $calendar, private Notifier $notifier) {}

    /**
     * @param  array{type: string, start_date: string, end_date: string, reason: string}  $input
     *
     * @throws ValidationException
     */
    public function submit(User $intern, array $input, ?UploadedFile $evidence): LeaveRequest
    {
        $profile = $intern->internProfile;
        [$start, $end] = [$input['start_date'], $input['end_date']];

        if ($profile === null || $start < $profile->start_date->toDateString() || $end > $profile->end_date->toDateString()) {
            throw ValidationException::withMessages(['start_date' => self::OUTSIDE_PERIOD]);
        }

        if ($this->calendar->workingDays($start, $end) === 0) {
            throw ValidationException::withMessages(['start_date' => self::NO_WORKING_DAY]);
        }

        $path = $evidence?->store("leaves/{$intern->id}");
        $path = is_string($path) ? $path : null;

        try {
            $leave = DB::transaction(function () use ($intern, $input, $start, $end, $path): LeaveRequest {
                // Baris akun dikunci agar dua pengajuan bersamaan tidak lolos cek tumpang tindih.
                User::query()->whereKey($intern->id)->lockForUpdate()->first();

                $overlaps = $intern->leaveRequests()
                    ->whereIn('status', [RequestStatus::Pending, RequestStatus::Approved])
                    ->whereDate('start_date', '<=', $end)
                    ->whereDate('end_date', '>=', $start)
                    ->exists();

                if ($overlaps) {
                    throw ValidationException::withMessages(['start_date' => self::OVERLAP]);
                }

                return $intern->leaveRequests()->create([
                    'type' => LeaveType::from($input['type']),
                    'start_date' => $start,
                    'end_date' => $end,
                    'reason' => $input['reason'],
                    'evidence_path' => $path,
                    'status' => RequestStatus::Pending,
                ]);
            });
        } catch (Throwable $e) {
            if ($path !== null) {
                Storage::delete($path);
            }

            throw $e;
        }

        $this->notifyMentor(
            $intern,
            "{$intern->shortName()} mengajukan {$leave->type->label()} ".IndonesianDate::range($leave->start_date, $leave->end_date).'.',
            ['open' => $leave->id],
        );

        return $leave;
    }

    /**
     * @throws ActionRejected
     */
    public function cancel(User $intern, LeaveRequest $leave): LeaveRequest
    {
        // Update bersyarat agar tidak bertabrakan dengan mentor atau admin yang sedang memutuskan.
        $updated = LeaveRequest::query()
            ->whereKey($leave->id)
            ->where('status', RequestStatus::Pending)
            ->update(['status' => RequestStatus::Cancelled]);

        $leave->refresh()->load('decider:id,name,role');

        if ($updated === 0) {
            throw $leave->status === RequestStatus::Cancelled
                ? new ActionRejected(self::ALREADY_CANCELLED, 'already_cancelled')
                : new ActionRejected(
                    'Izin ini sudah diproses oleh '.($leave->decider->name ?? 'mentor').'.',
                    'already_processed',
                );
        }

        $this->notifyMentor(
            $intern,
            "{$intern->shortName()} membatalkan pengajuan izin ".IndonesianDate::range($leave->start_date, $leave->end_date).'.',
            null,
        );

        return $leave;
    }

    /**
     * @param  array<string, mixed>|null  $params
     */
    private function notifyMentor(User $intern, string $text, ?array $params): void
    {
        $mentorId = $intern->internProfile?->mentor_id;

        if ($mentorId !== null) {
            $this->notifier->send([$mentorId], $text, '/izin', $params);
        }
    }
}
