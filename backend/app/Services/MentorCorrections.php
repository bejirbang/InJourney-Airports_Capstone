<?php

namespace App\Services;

use App\Enums\CorrectionStatus;
use App\Enums\Role;
use App\Exceptions\ActionRejected;
use App\Models\AttendanceCorrection;
use App\Models\User;
use App\Support\IndonesianDate;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Mentor memvalidasi: ACC meneruskan ke admin, Tolak menyelesaikan pengajuan. Mentor tidak mengubah presensi.
 */
class MentorCorrections
{
    public const TAB_WAITING = 'waiting';

    public const TAB_ALL = 'all';

    public const TABS = [self::TAB_WAITING, self::TAB_ALL];

    public function __construct(private Notifier $notifier) {}

    /**
     * "Menunggu Saya" terlama lebih dulu; "Semua" terbaru lebih dulu.
     *
     * @return array{corrections: Collection<int, AttendanceCorrection>, pending_count: int}
     */
    public function list(User $mentor, ?string $tab, ?int $internId): array
    {
        $waiting = ($tab ?? self::TAB_WAITING) === self::TAB_WAITING;

        $corrections = $this->query($mentor)
            ->with(['intern:id,name', 'mentor:id,name', 'admin:id,name'])
            ->when($waiting, fn (Builder $q) => $q->where('status', CorrectionStatus::PendingMentor))
            ->when($internId !== null, fn (Builder $q) => $q->where('intern_id', $internId))
            ->orderBy('created_at', $waiting ? 'asc' : 'desc')
            ->orderBy('id', $waiting ? 'asc' : 'desc')
            ->get();

        return [
            'corrections' => $corrections,
            'pending_count' => $this->pendingCount($mentor),
        ];
    }

    public function pendingCount(User $mentor): int
    {
        return $this->query($mentor)->where('status', CorrectionStatus::PendingMentor)->count();
    }

    /**
     * @throws ActionRejected
     */
    public function approve(User $mentor, AttendanceCorrection $correction, ?string $note, CarbonInterface $now): AttendanceCorrection
    {
        $correction = DB::transaction(function () use ($correction, $note, $now): AttendanceCorrection {
            $correction = AttendanceCorrections::lock($correction, CorrectionStatus::PendingMentor);
            $correction->update([
                'status' => CorrectionStatus::PendingAdmin,
                'mentor_note' => $note,
                'mentor_decided_at' => $now,
            ]);

            return $correction;
        });

        $date = IndonesianDate::short($correction->date);

        $this->notifier->send([$correction->intern_id], "Koreksi presensi {$date} disetujui mentor, menunggu admin.", '/presensi', ['tab' => 'koreksi', 'open' => $correction->id]);
        $this->notifier->send(
            User::query()->where('role', Role::Admin)->where('is_active', true)->pluck('id')->all(),
            "Koreksi {$correction->intern->shortName()} {$date} menunggu keputusan admin.",
            '/koreksi',
            ['open' => $correction->id],
        );

        return $correction;
    }

    /**
     * @throws ActionRejected
     */
    public function reject(User $mentor, AttendanceCorrection $correction, string $note, CarbonInterface $now): AttendanceCorrection
    {
        $correction = DB::transaction(function () use ($correction, $note, $now): AttendanceCorrection {
            $correction = AttendanceCorrections::lock($correction, CorrectionStatus::PendingMentor);
            $correction->update([
                'status' => CorrectionStatus::RejectedByMentor,
                'mentor_note' => $note,
                'mentor_decided_at' => $now,
            ]);

            return $correction;
        });

        $this->notifier->send(
            [$correction->intern_id],
            'Koreksi presensi '.IndonesianDate::short($correction->date).' ditolak mentor.',
            '/presensi',
            ['tab' => 'koreksi', 'open' => $correction->id],
        );

        return $correction;
    }

    /**
     * Pengajuan yang dicatat untuk mentor ini. Pengajuan yang masih menunggu mentor pindah saat mentor diganti.
     *
     * @return Builder<AttendanceCorrection>
     */
    private function query(User $mentor): Builder
    {
        return AttendanceCorrection::query()->where('mentor_id', $mentor->id)->whereHas('intern');
    }
}
