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

class LeaveDecisions
{
    public const CANCELLED = 'Pengajuan ini sudah dibatalkan intern.';

    public const BY_ADMIN = 'Izin ini sudah diproses oleh admin.';

    public const BY_MENTOR = 'Izin ini sudah diproses oleh mentor.';

    public const NO_EVIDENCE = 'Tidak ada surat resmi atau bukti.';

    public const EVIDENCE_UNCHECKED = 'Centang "Saya sudah memeriksa surat resmi atau bukti" lebih dulu.';

    public function __construct(private Notifier $notifier, private SystemSettings $settings) {}

    /**
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

            if ($byAdmin) {
                $this->ensureAdminMayDecide($leave, $approve, $now, $evidenceChecked);
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

        $result = $approve ? 'disetujui' : 'ditolak';
        $this->notifier->send([$leave->intern_id], self::describe($leave)." {$result}.", '/izin', ['open' => $leave->id]);

        $mentorId = $leave->intern->internProfile()->value('mentor_id');

        if ($byAdmin && $mentorId !== null) {
            $this->notifier->send([(int) $mentorId], "Izin {$leave->intern->shortName()} diproses oleh admin.", '/izin', ['open' => $leave->id]);
        }

        return $leave->load(['intern:id,name', 'decider:id,name,role']);
    }

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
     * Admin baru boleh memutuskan setelah izin menunggu lebih dari `leave_escalation_hours`. Mentor tetap boleh
     * memutuskan setelah batas itu selama admin belum.
     *
     * @throws ActionRejected
     */
    private function ensureAdminMayDecide(LeaveRequest $leave, bool $approve, CarbonInterface $now, bool $evidenceChecked): void
    {
        $hours = $this->settings->leaveEscalationHours();

        if (! $leave->isOverduePending($now, $hours)) {
            throw new ActionRejected("Izin ini masih menunggu mentor. Admin dapat memutuskannya setelah Pending lebih dari {$hours} jam.", 'not_overdue');
        }

        if (! $approve) {
            return;
        }

        if ($leave->evidence_url === null) {
            throw new ActionRejected(self::NO_EVIDENCE, 'no_evidence');
        }

        if (! $evidenceChecked) {
            throw new ActionRejected(self::EVIDENCE_UNCHECKED, 'evidence_unchecked');
        }
    }

    private static function describe(LeaveRequest $leave): string
    {
        return $leave->type->label().' '.IndonesianDate::range($leave->start_date, $leave->end_date);
    }
}
