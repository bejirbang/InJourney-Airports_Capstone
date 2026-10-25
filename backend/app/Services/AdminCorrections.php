<?php

namespace App\Services;

use App\Enums\CorrectionStatus;
use App\Exceptions\ActionRejected;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\IndonesianDate;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Admin hanya mengeksekusi pengajuan yang sudah di-ACC mentor. Hasil selalu Hadir: jam yang kosong diisi
 * jam jadwal hari itu, jam asli tidak ditimpa.
 */
class AdminCorrections
{
    public const TAB_ALL = 'all';

    public const TABS = ['pending_admin', 'pending_mentor', self::TAB_ALL];

    public const STILL_WITH_MENTOR = 'Koreksi ini masih menunggu mentor.';

    public const NOT_WORKDAY = 'Tanggal ini sekarang bukan hari kerja, jadi presensinya tidak bisa dikoreksi.';

    public function __construct(
        private WorkSchedules $schedules,
        private SystemSettings $settings,
        private Notifier $notifier,
    ) {}

    /**
     * Tab menunggu terlama lebih dulu (Menunggu Admin menurut waktu ACC mentor); "Semua" terbaru lebih dulu.
     *
     * @return array{corrections: Collection<int, AttendanceCorrection>, counts: array{pending_admin: int, pending_mentor: int}}
     */
    public function list(?string $tab, ?int $internId): array
    {
        $tab ??= CorrectionStatus::PendingAdmin->value;
        $pending = $tab !== self::TAB_ALL;
        $orderColumn = $tab === CorrectionStatus::PendingAdmin->value ? 'mentor_decided_at' : 'created_at';

        $corrections = $this->query()
            ->with(['intern:id,name', 'mentor:id,name', 'admin:id,name'])
            ->when($pending, fn (Builder $q) => $q->where('status', $tab))
            ->when($internId !== null, fn (Builder $q) => $q->where('intern_id', $internId))
            ->orderBy($orderColumn, $pending ? 'asc' : 'desc')
            ->orderBy('id', $pending ? 'asc' : 'desc')
            ->get();

        return [
            'corrections' => $corrections,
            'counts' => [
                'pending_admin' => $this->query()->where('status', CorrectionStatus::PendingAdmin)->count(),
                'pending_mentor' => $this->query()->where('status', CorrectionStatus::PendingMentor)->count(),
            ],
        ];
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    public function interns(): array
    {
        return array_values(User::query()
            ->whereHas('attendanceCorrections')
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $intern): array => ['id' => $intern->id, 'name' => $intern->name])
            ->all());
    }

    /**
     * Data tercatat dan hasil jika disetujui, untuk layar detail.
     *
     * @return array{recorded: array{clock_in_at: string|null, clock_out_at: string|null}, result: array{clock_in_at: string, clock_out_at: string}|null}
     */
    public function preview(AttendanceCorrection $correction): array
    {
        $attendance = AttendanceCorrections::attendanceOf($correction);
        [$start, $end] = $this->scheduledHours($correction, $attendance);

        return [
            'recorded' => AttendanceCorrections::recorded($attendance),
            'result' => $start === null || $end === null ? null : [
                'clock_in_at' => (string) AttendanceCorrections::time($attendance->clock_in_at ?? $start),
                'clock_out_at' => (string) AttendanceCorrections::time($attendance->clock_out_at ?? $end),
            ],
        ];
    }

    /**
     * Satu transaksi: baris presensi dibuat atau dilengkapi, ditandai Dikoreksi, pengajuan disetujui, dan
     * Log Aktivitas ditulis.
     *
     * @throws ActionRejected
     */
    public function approve(User $admin, AttendanceCorrection $correction, string $note, CarbonInterface $now): AttendanceCorrection
    {
        $correction = DB::transaction(function () use ($admin, $correction, $note, $now): AttendanceCorrection {
            $correction = $this->lockForAdmin($correction);

            $attendance = Attendance::query()
                ->where('intern_id', $correction->intern_id)
                ->whereDate('date', $correction->date->toDateString())
                ->lockForUpdate()
                ->first();

            [$start, $end] = $this->scheduledHours($correction, $attendance);

            if ($start === null || $end === null) {
                throw new ActionRejected(self::NOT_WORKDAY, 'not_workday');
            }

            $attendance ??= new Attendance([
                'intern_id' => $correction->intern_id,
                'date' => $correction->date->toDateString(),
                'scheduled_start' => $start,
                'scheduled_end' => $end,
                'late_tolerance_minutes' => $this->settings->lateToleranceMinutes(),
            ]);

            $attendance->fill([
                'clock_in_at' => $attendance->clock_in_at ?? $start,
                'clock_out_at' => $attendance->clock_out_at ?? $end,
                'is_corrected' => true,
                'correction_id' => $correction->id,
            ])->save();

            $correction->update([
                'status' => CorrectionStatus::Approved,
                'admin_id' => $admin->id,
                'admin_note' => $note,
                'admin_decided_at' => $now,
            ]);

            AuditLog::record(
                $admin,
                AuditLog::ACTION_CORRECTION,
                $correction->intern->name,
                'Setujui koreksi '.IndonesianDate::short($correction->date).': '
                    .AttendanceCorrections::time($attendance->clock_in_at).' - '.AttendanceCorrections::time($attendance->clock_out_at).'.',
            );

            return $correction;
        });

        $this->notifyDecision($correction, 'disetujui');

        return $correction;
    }

    /**
     * @throws ActionRejected
     */
    public function reject(User $admin, AttendanceCorrection $correction, string $note, CarbonInterface $now): AttendanceCorrection
    {
        $correction = DB::transaction(function () use ($admin, $correction, $note, $now): AttendanceCorrection {
            $correction = $this->lockForAdmin($correction);

            $correction->update([
                'status' => CorrectionStatus::RejectedByAdmin,
                'admin_id' => $admin->id,
                'admin_note' => $note,
                'admin_decided_at' => $now,
            ]);

            AuditLog::record($admin, AuditLog::ACTION_CORRECTION, $correction->intern->name, 'Tolak koreksi '.IndonesianDate::short($correction->date).'.');

            return $correction;
        });

        $this->notifyDecision($correction, 'ditolak');

        return $correction;
    }

    /**
     * @throws ActionRejected
     */
    private function lockForAdmin(AttendanceCorrection $correction): AttendanceCorrection
    {
        return AttendanceCorrections::lock($correction, CorrectionStatus::PendingAdmin, function (AttendanceCorrection $locked): void {
            if ($locked->status === CorrectionStatus::PendingMentor) {
                throw new ActionRejected(self::STILL_WITH_MENTOR, 'pending_mentor');
            }
        });
    }

    /**
     * Jam jadwal hari itu: salinan di baris presensi jika ada, selain itu jadwal bandara intern untuk tanggal itu.
     *
     * @return array{0: string|null, 1: string|null}
     */
    private function scheduledHours(AttendanceCorrection $correction, ?Attendance $attendance): array
    {
        if ($attendance !== null) {
            return [$attendance->scheduled_start, $attendance->scheduled_end];
        }

        $schedule = $this->schedules->forIntern($correction->intern->loadMissing('internProfile'), $correction->date->toDateString());

        return $schedule->isWorkday ? [$schedule->start, $schedule->end] : [null, null];
    }

    private function notifyDecision(AttendanceCorrection $correction, string $result): void
    {
        $date = IndonesianDate::short($correction->date);

        $this->notifier->send([$correction->intern_id], "Koreksi presensi {$date} {$result}.", '/presensi', ['tab' => 'koreksi', 'open' => $correction->id]);

        if ($correction->mentor_id !== null) {
            $this->notifier->send([$correction->mentor_id], "Koreksi {$correction->intern->shortName()} {$date} {$result} admin.", '/koreksi', ['open' => $correction->id]);
        }
    }

    /**
     * @return Builder<AttendanceCorrection>
     */
    private function query(): Builder
    {
        return AttendanceCorrection::query()->whereHas('intern');
    }
}
