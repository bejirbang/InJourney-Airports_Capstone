<?php

namespace App\Services;

use App\Enums\RequestStatus;
use App\Enums\Role;
use App\Exceptions\ActionRejected;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Support\IndonesianDate;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Menyetujui atau menolak izin Pending (docs/design-mentor.md Alur 7, docs/design-admin.md Alur 5).
 * Dipakai mentor sekarang; admin memakai service yang sama dengan syarat bukti tambahan di sisinya.
 *
 * Status absensi tidak disimpan ulang: izin disetujui langsung terbaca sebagai Izin oleh AttendanceCalendar.
 */
class LeaveDecisions
{
    public const CANCELLED = 'Pengajuan ini sudah dibatalkan intern.';

    public const BY_ADMIN = 'Izin ini sudah diproses oleh admin.';

    public function __construct(private Notifier $notifier) {}

    /**
     * @throws ActionRejected
     */
    public function decide(User $actor, LeaveRequest $leave, bool $approve, string $note, CarbonInterface $now): LeaveRequest
    {
        $leave = DB::transaction(function () use ($actor, $leave, $approve, $note, $now): LeaveRequest {
            // Dikunci agar pembatalan intern atau keputusan admin di saat yang sama tidak tertimpa.
            $leave = LeaveRequest::query()->lockForUpdate()->findOrFail($leave->id);

            if ($leave->status !== RequestStatus::Pending) {
                throw self::alreadyClosed($leave);
            }

            $leave->update([
                'status' => $approve ? RequestStatus::Approved : RequestStatus::Rejected,
                'decided_by' => $actor->id,
                'decision_note' => $note,
                'decided_at' => $now,
            ]);

            return $leave;
        });

        // design-intern.md 16: "Izin Sakit 13-14 Okt disetujui." Klik membuka detail izin.
        $result = $approve ? 'disetujui' : 'ditolak';
        $this->notifier->send(
            [$leave->intern_id],
            "{$leave->type->label()} ".IndonesianDate::range($leave->start_date, $leave->end_date)." {$result}.",
            '/izin',
            ['open' => $leave->id],
        );

        return $leave->load(['intern:id,name', 'decider:id,name,role']);
    }

    /**
     * Pesan untuk izin yang sudah tidak Pending saat keputusan dikirim (9.4).
     */
    public static function alreadyClosed(LeaveRequest $leave): ActionRejected
    {
        if ($leave->status === RequestStatus::Cancelled) {
            return new ActionRejected(self::CANCELLED, 'cancelled');
        }

        $decider = $leave->decider()->first();
        $message = $decider === null || $decider->hasRole(Role::Admin)
            ? self::BY_ADMIN
            : "Izin ini sudah diproses oleh {$decider->name}.";

        return new ActionRejected($message, 'already_processed');
    }
}
