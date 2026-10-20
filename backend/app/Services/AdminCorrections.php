<?php

namespace App\Services;

use App\Enums\RequestStatus;
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
 * Koreksi Absensi dari sisi admin (docs/design-admin.md, Alur 4): daftar, detail, Setujui, Tolak.
 *
 * Admin hanya mengubah jam clock in dan clock out. Status hari itu (Hadir, Lupa Clock Out, Terlambat)
 * tidak disimpan, jadi langsung terhitung ulang oleh AttendanceCalendar. Validasi lokasi tidak dijalankan.
 */
class AdminCorrections
{
    public const FILTER_ALL = 'all';

    /** Filter Status: default Pending (6.2). */
    public const FILTERS = ['pending', 'approved', 'rejected', 'cancelled', self::FILTER_ALL];

    public const CANCELLED = 'Permintaan ini sudah dibatalkan intern.';

    public function __construct(private AttendanceCalendar $calendar, private Notifier $notifier) {}

    /**
     * Pending: paling lama diajukan lebih dulu (antrean). Status lain: terbaru lebih dulu.
     *
     * @param  array{status?: string|null, intern_id?: int|null, from?: string|null, to?: string|null}  $filters
     * @return Collection<int, AttendanceCorrection>
     */
    public function list(array $filters): Collection
    {
        $status = $filters['status'] ?? RequestStatus::Pending->value;
        $pending = $status === RequestStatus::Pending->value;

        return AttendanceCorrection::query()
            ->with('intern:id,name')
            ->whereHas('intern')
            ->when($status !== self::FILTER_ALL, fn (Builder $q) => $q->where('status', $status))
            ->when($filters['intern_id'] ?? null, fn (Builder $q, int $id) => $q->where('intern_id', $id))
            ->when($filters['from'] ?? null, fn (Builder $q, string $from) => $q->whereDate('date', '>=', $from))
            ->when($filters['to'] ?? null, fn (Builder $q, string $to) => $q->whereDate('date', '<=', $to))
            ->orderBy('created_at', $pending ? 'asc' : 'desc')
            ->orderBy('id', $pending ? 'asc' : 'desc')
            ->get();
    }

    /**
     * Pilihan filter Intern: intern yang pernah mengajukan koreksi, urut nama.
     *
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
     * Status hari itu saat ini, untuk kolom "Data tercatat" (6.3). Null jika di luar periode magang.
     */
    public function currentStatus(AttendanceCorrection $correction, CarbonInterface $now): ?string
    {
        $date = $correction->date->toDateString();
        $day = $this->calendar->days($correction->intern->loadMissing('internProfile'), $date, $date, $now)[$date] ?? null;

        return $day === null ? null : $day['status']->value;
    }

    /**
     * Setujui: jam final menggantikan absensi hari itu, atau membuat baris absensi baru jika intern
     * belum clock in. Baris diberi tanda "Dikoreksi admin".
     *
     * @throws ActionRejected
     */
    public function approve(User $admin, AttendanceCorrection $correction, string $clockIn, string $clockOut, string $note, CarbonInterface $now): AttendanceCorrection
    {
        $correction = DB::transaction(function () use ($admin, $correction, $clockIn, $clockOut, $note, $now): AttendanceCorrection {
            $correction = $this->lockPending($correction);

            $times = ['clock_in_at' => $clockIn.':00', 'clock_out_at' => $clockOut.':00', 'is_corrected' => true];
            $attendance = Attendance::query()
                ->where('intern_id', $correction->intern_id)
                ->whereDate('date', $correction->date->toDateString())
                ->lockForUpdate()
                ->first();

            // Kantor dan koordinat lama tetap; hari tanpa clock in tidak punya kantor.
            $attendance === null
                ? Attendance::query()->create(['intern_id' => $correction->intern_id, 'date' => $correction->date->toDateString(), ...$times])
                : $attendance->update($times);

            $correction->update([
                'status' => RequestStatus::Approved,
                'decided_by' => $admin->id,
                'decision_note' => $note,
                'final_clock_in' => $clockIn.':00',
                'final_clock_out' => $clockOut.':00',
                'decided_at' => $now,
            ]);

            AuditLog::record(
                $admin,
                AuditLog::ACTION_ATTENDANCE,
                $correction->intern->name,
                'Setujui koreksi '.IndonesianDate::short($correction->date).": {$clockIn} - {$clockOut}.",
            );

            return $correction;
        });

        $this->notifyIntern($correction, 'disetujui');

        return $correction;
    }

    /**
     * Tolak: permintaan ditutup, data absensi tidak berubah.
     *
     * @throws ActionRejected
     */
    public function reject(User $admin, AttendanceCorrection $correction, string $note, CarbonInterface $now): AttendanceCorrection
    {
        $correction = DB::transaction(function () use ($admin, $correction, $note, $now): AttendanceCorrection {
            $correction = $this->lockPending($correction);

            $correction->update([
                'status' => RequestStatus::Rejected,
                'decided_by' => $admin->id,
                'decision_note' => $note,
                'decided_at' => $now,
            ]);

            AuditLog::record(
                $admin,
                AuditLog::ACTION_ATTENDANCE,
                $correction->intern->name,
                'Tolak koreksi '.IndonesianDate::short($correction->date).'.',
            );

            return $correction;
        });

        $this->notifyIntern($correction, 'ditolak');

        return $correction;
    }

    /**
     * Dikunci agar dua admin, atau admin dan intern yang membatalkan, tidak memproses bersamaan (6.5).
     *
     * @throws ActionRejected
     */
    private function lockPending(AttendanceCorrection $correction): AttendanceCorrection
    {
        $correction = AttendanceCorrection::query()->with('intern:id,name')->lockForUpdate()->findOrFail($correction->id);

        if ($correction->status === RequestStatus::Cancelled) {
            throw new ActionRejected(self::CANCELLED, 'cancelled');
        }

        if ($correction->status !== RequestStatus::Pending) {
            $name = $correction->decider()->value('name') ?? 'admin';

            throw new ActionRejected("Permintaan ini sudah diproses oleh {$name}.", 'already_processed');
        }

        return $correction;
    }

    /**
     * design-intern.md 16: "Koreksi absensi 9 Okt disetujui." Klik membuka detail koreksi;
     * catatan admin dibaca di detail itu.
     */
    private function notifyIntern(AttendanceCorrection $correction, string $result): void
    {
        $this->notifier->send(
            [$correction->intern_id],
            'Koreksi absensi '.IndonesianDate::short($correction->date)." {$result}.",
            '/absensi',
            ['tab' => 'koreksi', 'open' => $correction->id],
        );
    }
}
