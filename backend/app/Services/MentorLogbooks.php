<?php

namespace App\Services;

use App\Enums\LogbookReviewAction;
use App\Enums\LogbookStatus;
use App\Exceptions\ActionRejected;
use App\Models\Logbook;
use App\Models\LogbookReview;
use App\Models\User;
use App\Support\IndonesianDate;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Review logbook oleh mentor saat ini (dibaca dari `intern_profiles.mentor_id`, jadi logbook yang menunggu ikut
 * pindah saat mentor diganti). Hanya Setujui atau Revisi, tanpa Tolak, dan tanpa eskalasi ke admin.
 */
class MentorLogbooks
{
    public const TAB_PENDING = 'pending_review';

    public const TAB_REVISION = 'revision';

    public const TAB_ALL = 'all';

    public const TABS = [self::TAB_PENDING, self::TAB_REVISION, self::TAB_ALL];

    public const ALREADY_APPROVED = 'Logbook ini sudah disetujui.';

    public const IN_REVISION = 'Logbook ini sedang diperbaiki intern.';

    public const NOT_SUBMITTED = 'Logbook ini belum dikirim intern.';

    public const INTERN_INACTIVE = 'Intern sudah nonaktif dan tidak dapat memperbaiki logbook.';

    public function __construct(private AccountAccess $access, private Notifier $notifier) {}

    /**
     * Menunggu Review dan Revisi diurutkan dari tanggal paling lama; Semua dari yang terbaru.
     *
     * @return array{logbooks: Collection<int, Logbook>, counts: array{pending_review: int, revision: int}}
     */
    public function list(User $mentor, ?string $tab, ?int $internId): array
    {
        $tab ??= self::TAB_PENDING;

        $logbooks = $this->ordered($this->query($mentor), $tab)
            ->with(['attendance.intern:id,name', 'reviews'])
            ->when($internId !== null, fn (Builder $q) => $q->whereHas('attendance', fn (Builder $a) => $a->where('intern_id', $internId)))
            ->get();

        return [
            'logbooks' => $logbooks,
            'counts' => [
                'pending_review' => $this->query($mentor)->where('logbooks.status', LogbookStatus::PendingReview)->count(),
                'revision' => $this->query($mentor)->where('logbooks.status', LogbookStatus::Revision)->count(),
            ],
        ];
    }

    public function pendingCount(User $mentor): int
    {
        return $this->query($mentor)->where('logbooks.status', LogbookStatus::PendingReview)->count();
    }

    public function isMentorOf(User $mentor, Logbook $logbook): bool
    {
        return $this->query($mentor)->whereKey($logbook->id)->exists();
    }

    /**
     * Logbook sebelum dan sesudahnya dalam urutan tab yang sama, untuk tombol Sebelumnya/Berikutnya.
     *
     * @return array{previous_id: int|null, next_id: int|null}
     */
    public function neighbours(User $mentor, Logbook $logbook, ?string $tab): array
    {
        /** @var list<int> $ids */
        $ids = array_values($this->ordered($this->query($mentor), $tab ?? self::TAB_PENDING)->pluck('logbooks.id')->map(intval(...))->all());
        $position = array_search($logbook->id, $ids, true);

        if ($position === false) {
            return ['previous_id' => null, 'next_id' => null];
        }

        return [
            'previous_id' => $ids[$position - 1] ?? null,
            'next_id' => $ids[$position + 1] ?? null,
        ];
    }

    /**
     * Setujui berlaku untuk logbook Menunggu Review. Logbook Revisi milik intern yang sudah nonaktif juga boleh
     * langsung disetujui, karena intern tidak bisa lagi memperbaikinya dan penilaian tertahan.
     */
    public function canApprove(Logbook $logbook, CarbonInterface $now): bool
    {
        return $logbook->status === LogbookStatus::PendingReview
            || ($logbook->status === LogbookStatus::Revision && $this->internInactive($logbook, $now));
    }

    public function internInactive(Logbook $logbook, CarbonInterface $now): bool
    {
        return $this->access->denialReason($logbook->attendance->intern->loadMissing('internProfile'), $now) !== null;
    }

    /**
     * @throws ActionRejected
     */
    public function approve(User $mentor, Logbook $logbook, ?string $comment, CarbonInterface $now): Logbook
    {
        return DB::transaction(function () use ($mentor, $logbook, $comment, $now): Logbook {
            $logbook = $this->lock($logbook);

            if (! $this->canApprove($logbook, $now)) {
                throw self::notReviewable($logbook);
            }

            $this->markApproved($mentor, $logbook, $comment, $now);

            return $logbook;
        });
    }

    /**
     * Setujui banyak sekaligus. Logbook yang sudah tidak menunggu review (atau bukan milik intern bimbingan)
     * dilewati, sisanya tetap disetujui dan masing-masing mendapat satu riwayat review.
     *
     * @param  list<int>  $ids
     * @return array{approved: list<int>, skipped: list<int>}
     */
    public function approveMany(User $mentor, array $ids, CarbonInterface $now): array
    {
        return DB::transaction(function () use ($mentor, $ids, $now): array {
            $logbooks = $this->query($mentor)
                ->whereIn('logbooks.id', $ids)
                ->where('logbooks.status', LogbookStatus::PendingReview)
                ->orderBy('logbooks.id')
                ->lockForUpdate()
                ->get();

            foreach ($logbooks as $logbook) {
                $this->markApproved($mentor, $logbook, null, $now);
            }

            $approved = array_values($logbooks->pluck('id')->all());

            return [
                'approved' => $approved,
                'skipped' => array_values(array_diff($ids, $approved)),
            ];
        });
    }

    /**
     * @throws ActionRejected
     */
    public function requestRevision(User $mentor, Logbook $logbook, string $comment): Logbook
    {
        $logbook = DB::transaction(function () use ($mentor, $logbook, $comment): Logbook {
            $logbook = $this->lock($logbook);

            if ($logbook->status !== LogbookStatus::PendingReview) {
                throw self::notReviewable($logbook);
            }

            $logbook->update(['status' => LogbookStatus::Revision]);
            $logbook->reviews()->create(['mentor_id' => $mentor->id, 'action' => LogbookReviewAction::Revision, 'comment' => $comment]);

            return $logbook;
        });

        $date = $logbook->attendance->date;

        $this->notifier->send(
            [$logbook->attendance->intern_id],
            'Logbook '.IndonesianDate::short($date).' perlu direvisi.',
            '/logbook',
            ['date' => $date->toDateString()],
        );

        return $logbook;
    }

    /**
     * Logbook yang sudah dikirim (bukan draft) milik intern yang mentornya saat ini adalah $mentor.
     *
     * @return Builder<Logbook>
     */
    private function query(User $mentor): Builder
    {
        return Logbook::query()
            ->select('logbooks.*')
            ->join('attendances', 'attendances.id', '=', 'logbooks.attendance_id')
            ->join('intern_profiles', 'intern_profiles.user_id', '=', 'attendances.intern_id')
            ->join('users as interns', 'interns.id', '=', 'attendances.intern_id')
            ->whereNull('interns.deleted_at')
            ->where('intern_profiles.mentor_id', $mentor->id)
            ->where('logbooks.status', '!=', LogbookStatus::Draft);
    }

    /**
     * @param  Builder<Logbook>  $query
     * @return Builder<Logbook>
     */
    private function ordered(Builder $query, string $tab): Builder
    {
        $oldestFirst = $tab !== self::TAB_ALL;

        return $query
            ->when($tab !== self::TAB_ALL, fn (Builder $q) => $q->where('logbooks.status', $tab))
            ->orderBy('attendances.date', $oldestFirst ? 'asc' : 'desc')
            ->orderBy('interns.name')
            ->orderBy('logbooks.id');
    }

    private function lock(Logbook $logbook): Logbook
    {
        return Logbook::query()->with('attendance.intern')->lockForUpdate()->findOrFail($logbook->id);
    }

    private function markApproved(User $mentor, Logbook $logbook, ?string $comment, CarbonInterface $now): void
    {
        $logbook->update([
            'status' => LogbookStatus::Approved,
            'approved_at' => $now,
            'approved_by' => $mentor->id,
        ]);

        LogbookReview::query()->create([
            'logbook_id' => $logbook->id,
            'mentor_id' => $mentor->id,
            'action' => LogbookReviewAction::Approved,
            'comment' => $comment,
        ]);
    }

    private static function notReviewable(Logbook $logbook): ActionRejected
    {
        return match ($logbook->status) {
            LogbookStatus::Approved => new ActionRejected(self::ALREADY_APPROVED, 'already_approved'),
            LogbookStatus::Revision => new ActionRejected(self::IN_REVISION, 'in_revision'),
            default => new ActionRejected(self::NOT_SUBMITTED, 'not_submitted'),
        };
    }
}
