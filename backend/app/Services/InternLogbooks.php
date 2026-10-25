<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Enums\LogbookStatus;
use App\Exceptions\ActionRejected;
use App\Models\Attendance;
use App\Models\Logbook;
use App\Models\LogbookReview;
use App\Models\User;
use App\Support\IndonesianDate;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Logbook intern: draft hari ini sampai clock out, perbaikan saat Revisi, dan pengisian hari yang
 * dikoreksi. Hari Lupa Clock Out yang belum dikoreksi tetap draft dan terkunci sampai koreksi disetujui.
 */
class InternLogbooks
{
    /** Menyimpan draft hari ini sebelum clock out. */
    public const ACTION_SAVE = 'save';

    /** Mengisi hari yang dikoreksi, langsung Menunggu Review. */
    public const ACTION_SUBMIT = 'submit';

    /** Mengirim ulang setelah mentor meminta revisi. */
    public const ACTION_RESUBMIT = 'resubmit';

    /** Logbook yang belum terkirim pada hari hasil koreksi. */
    public const MISSING = 'missing';

    public const FILTERS = ['draft', 'pending_review', 'revision', 'approved', self::MISSING];

    public const NOT_CLOCKED_IN = 'Clock in dulu untuk mengisi logbook.';

    public const NO_ATTENDANCE = 'Tidak ada presensi pada tanggal ini, jadi tidak ada logbook.';

    public const PENDING_REVIEW = 'Logbook ini sedang menunggu review mentor.';

    public const APPROVED = 'Logbook yang sudah disetujui tidak bisa diubah.';

    public const NEEDS_CORRECTION = 'Ajukan koreksi presensi untuk tanggal ini dulu. Logbook bisa dikirim setelah koreksi disetujui.';

    public function __construct(
        private AttendanceHistory $history,
        private Notifier $notifier,
    ) {}

    public static function action(Attendance $attendance, ?Logbook $logbook, string $today): ?string
    {
        return match (true) {
            $logbook?->status === LogbookStatus::Revision => self::ACTION_RESUBMIT,
            $logbook !== null && $logbook->status !== LogbookStatus::Draft => null,
            $attendance->is_corrected => self::ACTION_SUBMIT,
            $attendance->date->toDateString() === $today && $attendance->clock_out_at === null => self::ACTION_SAVE,
            default => null,
        };
    }

    /**
     * Status logbook untuk daftar: status tersimpan, "missing" untuk hari hasil koreksi yang belum
     * terkirim, null untuk hari tanpa presensi.
     */
    public static function state(?Attendance $attendance): ?string
    {
        if ($attendance === null) {
            return null;
        }

        $logbook = $attendance->logbook;

        if ($attendance->is_corrected && ($logbook === null || $logbook->status === LogbookStatus::Draft)) {
            return self::MISSING;
        }

        return $logbook?->status->value;
    }

    /**
     * Revisi dan hari hasil koreksi yang belum terkirim, sepanjang periode magang, terlama lebih dulu.
     *
     * @return list<array{date: string, logbook_state: string, comment: string|null}>
     */
    public function actionNeeded(User $intern): array
    {
        $rows = Attendance::query()
            ->with(['logbook.reviews' => fn ($q) => $q->latest()->latest('id')])
            ->where('intern_id', $intern->id)
            ->where(fn (Builder $q) => $q
                ->whereHas('logbook', fn (Builder $l) => $l->where('status', LogbookStatus::Revision))
                ->orWhere(fn (Builder $c) => $c
                    ->where('is_corrected', true)
                    ->whereDoesntHave('logbook', fn (Builder $l) => $l->where('status', '!=', LogbookStatus::Draft))))
            ->orderBy('date')
            ->get();

        return array_values($rows->map(fn (Attendance $attendance): array => [
            'date' => $attendance->date->toDateString(),
            'logbook_state' => (string) self::state($attendance),
            'comment' => $attendance->logbook?->status === LogbookStatus::Revision
                ? $attendance->logbook->reviews->first()?->comment
                : null,
        ])->all());
    }

    /**
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function month(User $intern, ?string $month, ?string $filter, CarbonInterface $now): array
    {
        [$month, $months, $days] = $this->history->resolveMonth($intern, $month, $now);
        $today = $now->toDateString();
        $rows = [];

        foreach (array_reverse($days, preserve_keys: true) as $date => $day) {
            if ($day['status'] === AttendanceStatus::Holiday) {
                continue;
            }

            $attendance = $day['attendance'];
            $state = self::state($attendance);

            if ($filter !== null && $state !== $filter) {
                continue;
            }

            $rows[] = [
                'date' => $date,
                'attendance_status' => $day['status']->value,
                'leave_type' => $day['leave']?->type->value,
                'logbook_state' => $state,
                'work' => $attendance?->logbook?->work,
                'action' => $attendance === null ? null : self::action($attendance, $attendance->logbook, $today),
            ];
        }

        return [
            'month' => $month,
            'selectable_months' => $months,
            'action_needed' => $this->actionNeeded($intern),
            'days' => $rows,
        ];
    }

    /**
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function day(User $intern, string $date, CarbonInterface $now): array
    {
        $day = $this->history->validDay($intern, $date, $now);
        $attendance = $day['attendance'];
        $logbook = $attendance?->logbook?->load(['approver:id,name', 'reviews' => fn ($q) => $q->with('mentor:id,name')->latest()->latest('id')]);

        return [
            'date' => $date,
            'attendance' => $attendance === null ? null : [
                'status' => $day['status']->value,
                'clock_in_at' => self::time($attendance->clock_in_at),
                'clock_out_at' => self::time($attendance->clock_out_at),
                'missed_clock_out' => $day['missed_clock_out'],
                'is_corrected' => $day['is_corrected'],
            ],
            'logbook_state' => self::state($attendance),
            'logbook' => $logbook === null ? null : self::logbook($logbook),
            'reviews' => $logbook === null ? [] : array_values($logbook->reviews->map(fn (LogbookReview $review): array => [
                'action' => $review->action->value,
                'comment' => $review->comment,
                'mentor' => $review->mentor?->name,
                'created_at' => $review->created_at?->toIso8601String(),
            ])->all()),
            'action' => $attendance === null ? null : self::action($attendance, $logbook, $now->toDateString()),
        ];
    }

    /**
     * Baris presensi dikunci agar tidak bertabrakan dengan clock out atau review mentor yang berjalan bersamaan.
     *
     * @return array{logbook: Logbook, action: string, created: bool}
     *
     * @throws ActionRejected
     * @throws ValidationException
     */
    public function save(User $intern, string $date, string $work, ?string $notes, CarbonInterface $now): array
    {
        $this->history->validDay($intern, $date, $now);
        $today = $now->toDateString();

        $result = DB::transaction(function () use ($intern, $date, $work, $notes, $now, $today): array {
            $attendance = $intern->attendances()->whereDate('date', $date)->lockForUpdate()->first();

            if ($attendance === null) {
                throw $date === $today
                    ? new ActionRejected(self::NOT_CLOCKED_IN, 'not_clocked_in')
                    : new ActionRejected(self::NO_ATTENDANCE, 'no_attendance');
            }

            $logbook = Logbook::query()->where('attendance_id', $attendance->id)->lockForUpdate()->first();
            $action = self::action($attendance, $logbook, $today);

            if ($action === null) {
                throw match ($logbook?->status) {
                    LogbookStatus::PendingReview => new ActionRejected(self::PENDING_REVIEW, 'pending_review'),
                    LogbookStatus::Approved => new ActionRejected(self::APPROVED, 'approved'),
                    default => new ActionRejected(self::NEEDS_CORRECTION, 'needs_correction'),
                };
            }

            $submitted = $action !== self::ACTION_SAVE;
            $logbook ??= new Logbook(['attendance_id' => $attendance->id]);
            $created = ! $logbook->exists;

            $logbook->fill([
                'work' => $work,
                'notes' => $notes,
                'status' => $submitted ? LogbookStatus::PendingReview : LogbookStatus::Draft,
                'submitted_at' => $submitted ? $now : $logbook->submitted_at,
            ])->save();

            return ['logbook' => $logbook->setRelation('attendance', $attendance), 'action' => $action, 'created' => $created];
        });

        if ($result['action'] === self::ACTION_RESUBMIT) {
            $this->notifyMentor($intern, $result['logbook']);
        }

        return $result;
    }

    /**
     * Dipanggil di dalam transaksi clock out: logbook hari itu dibuat atau diubah dari isian yang ikut dikirim,
     * lalu terkirim ke mentor. Tanpa notifikasi; mentor melihat angka di menu dan Dashboard.
     */
    public static function submitOnClockOut(Attendance $attendance, ?string $work, ?string $notes, CarbonInterface $now): ?Logbook
    {
        $logbook = Logbook::query()->where('attendance_id', $attendance->id)->lockForUpdate()->first();

        if ($work !== null) {
            $logbook ??= new Logbook(['attendance_id' => $attendance->id]);
            $logbook->fill(['work' => $work, 'notes' => $notes]);
        }

        if ($logbook === null) {
            return null;
        }

        $logbook->fill(['status' => LogbookStatus::PendingReview, 'submitted_at' => $now])->save();

        return $logbook;
    }

    /**
     * @return array<string, mixed>
     */
    public static function logbook(Logbook $logbook): array
    {
        return [
            'id' => $logbook->id,
            'work' => $logbook->work,
            'notes' => $logbook->notes,
            'status' => $logbook->status->value,
            'updated_at' => $logbook->updated_at?->toIso8601String(),
            'submitted_at' => $logbook->submitted_at?->toIso8601String(),
            'approved_at' => $logbook->approved_at?->toIso8601String(),
            'approved_by' => $logbook->approver?->name,
        ];
    }

    private function notifyMentor(User $intern, Logbook $logbook): void
    {
        $mentorId = $intern->internProfile?->mentor_id;

        if ($mentorId !== null) {
            $this->notifier->send(
                [$mentorId],
                "{$intern->shortName()} memperbaiki logbook ".IndonesianDate::short($logbook->attendance->date).'.',
                '/logbook',
                ['open' => $logbook->id],
            );
        }
    }

    private static function time(?string $time): ?string
    {
        return $time === null ? null : substr($time, 0, 5);
    }
}
