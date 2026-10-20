<?php

namespace App\Services;

use App\Enums\RequestStatus;
use App\Enums\Role;
use App\Exceptions\ActionRejected;
use App\Models\AuditLog;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Support\IndonesianDate;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Menyetujui atau menolak izin Pending (docs/design-mentor.md Alur 7, docs/design-admin.md Alur 5).
 *
 * Mentor memproses lebih dulu. Admin boleh menolak izin Pending kapan saja, tetapi hanya boleh menyetujui
 * izin yang Pending lebih dari 24 jam dan punya bukti yang sudah ia periksa (design-admin.md 7,
 * design-mentor.md 13.4; menolak tanpa menunggu 24 jam diputuskan pemilik repo 20 Okt 2026).
 * Keputusan admin memberi tahu mentor dan masuk Log Aktivitas.
 *
 * Status absensi tidak disimpan ulang: izin disetujui langsung terbaca sebagai Izin oleh AttendanceCalendar.
 */
class LeaveDecisions
{
    public const CANCELLED = 'Pengajuan ini sudah dibatalkan intern.';

    public const BY_ADMIN = 'Izin ini sudah diproses oleh admin.';

    public const BY_MENTOR = 'Izin ini sudah diproses oleh mentor.';

    public const NOT_OVERDUE = 'Izin ini masih menunggu mentor. Admin dapat menyetujuinya setelah Pending lebih dari 24 jam.';

    public const NO_EVIDENCE = 'Tidak ada surat resmi atau bukti.';

    public const EVIDENCE_UNCHECKED = 'Centang "Saya sudah memeriksa surat resmi atau bukti" lebih dulu.';

    public function __construct(private Notifier $notifier) {}

    /**
     * @param  bool  $evidenceChecked  hanya untuk admin: centang "Saya sudah memeriksa bukti"
     *
     * @throws ActionRejected
     */
    public function decide(User $actor, LeaveRequest $leave, bool $approve, string $note, CarbonInterface $now, bool $evidenceChecked = false): LeaveRequest
    {
        $byAdmin = $actor->hasRole(Role::Admin);

        $leave = DB::transaction(function () use ($actor, $leave, $approve, $note, $now, $byAdmin, $evidenceChecked): LeaveRequest {
            // Dikunci agar pembatalan intern atau keputusan mentor dan admin di saat yang sama tidak tertimpa.
            $leave = LeaveRequest::query()->with('intern:id,name')->lockForUpdate()->findOrFail($leave->id);

            if ($leave->status !== RequestStatus::Pending) {
                throw self::alreadyClosed($leave, $byAdmin);
            }

            if ($byAdmin && $approve) {
                self::ensureAdminMayApprove($leave, $now, $evidenceChecked);
            }

            $leave->update([
                'status' => $approve ? RequestStatus::Approved : RequestStatus::Rejected,
                'decided_by' => $actor->id,
                'decision_note' => $note,
                'decided_at' => $now,
            ]);

            if ($byAdmin) {
                AuditLog::record(
                    $actor,
                    AuditLog::ACTION_LEAVE,
                    $leave->intern->name,
                    ($approve ? 'Setujui ' : 'Tolak ').self::describe($leave).'.',
                );
            }

            return $leave;
        });

        // design-intern.md 16: "Izin Sakit 13-14 Okt disetujui." Klik membuka detail izin.
        $result = $approve ? 'disetujui' : 'ditolak';
        $this->notifier->send([$leave->intern_id], self::describe($leave)." {$result}.", '/izin', ['open' => $leave->id]);

        // design-mentor.md 14: "Izin Dewi S. diproses oleh admin." untuk mentor saat ini.
        $mentorId = $leave->intern->internProfile()->value('mentor_id');

        if ($byAdmin && $mentorId !== null) {
            $this->notifier->send([(int) $mentorId], "Izin {$leave->intern->shortName()} diproses oleh admin.", '/izin', ['open' => $leave->id]);
        }

        return $leave->load(['intern:id,name', 'decider:id,name,role']);
    }

    /**
     * Pesan untuk izin yang sudah tidak Pending saat keputusan dikirim (design-mentor.md 9.4, design-admin.md 7.4).
     * Mentor melihat nama mentor lain; admin melihat "oleh mentor" atau "oleh admin".
     */
    public static function alreadyClosed(LeaveRequest $leave, bool $forAdmin = false): ActionRejected
    {
        if ($leave->status === RequestStatus::Cancelled) {
            return new ActionRejected(self::CANCELLED, 'cancelled');
        }

        $decider = $leave->decider()->first();

        $message = match (true) {
            $decider === null || $decider->hasRole(Role::Admin) => self::BY_ADMIN,
            $forAdmin => self::BY_MENTOR,
            default => "Izin ini sudah diproses oleh {$decider->name}.",
        };

        return new ActionRejected($message, 'already_processed');
    }

    /**
     * Syarat admin untuk Setujui (design-admin.md 7): izin menggantung lebih dari 24 jam dan bukti sudah
     * diperiksa. Tolak tidak punya syarat ini (7.4).
     *
     * @throws ActionRejected
     */
    private static function ensureAdminMayApprove(LeaveRequest $leave, CarbonInterface $now, bool $evidenceChecked): void
    {
        if (! $leave->isOverduePending($now)) {
            throw new ActionRejected(self::NOT_OVERDUE, 'not_overdue');
        }

        if ($leave->evidence_path === null) {
            throw new ActionRejected(self::NO_EVIDENCE, 'no_evidence');
        }

        if (! $evidenceChecked) {
            throw new ActionRejected(self::EVIDENCE_UNCHECKED, 'evidence_unchecked');
        }
    }

    /**
     * "Izin Sakit 13-14 Okt".
     */
    private static function describe(LeaveRequest $leave): string
    {
        return $leave->type->label().' '.IndonesianDate::range($leave->start_date, $leave->end_date);
    }
}
