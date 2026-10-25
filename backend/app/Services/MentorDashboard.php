<?php

namespace App\Services;

use App\Enums\CorrectionStatus;
use App\Enums\RequestStatus;
use App\Models\Announcement;
use App\Models\AttendanceCorrection;
use App\Models\LeaveRequest;
use App\Models\Logbook;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * Dashboard mentor: kartu presensi intern bimbingan hari ini dan antrean tindakan (logbook, koreksi, izin, siap
 * dinilai). Setiap kotak maksimal lima baris; kotak kosong disembunyikan frontend.
 */
class MentorDashboard
{
    public const LIST_LIMIT = 5;

    public const ANNOUNCEMENT_LIMIT = 3;

    public function __construct(
        private AccountAccess $access,
        private SystemSettings $settings,
        private DashboardCards $cards,
        private MentorLogbooks $logbooks,
        private Assessments $assessments,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function for(User $mentor, CarbonInterface $now): array
    {
        $interns = User::query()
            ->with('internProfile')
            ->whereHas('internProfile', fn (Builder $q) => $q->where('mentor_id', $mentor->id))
            ->orderBy('name')
            ->get();

        $active = $interns->filter(fn (User $intern): bool => $this->access->denialReason($intern, $now) === null);
        $today = $this->cards->today($active, $now);

        return [
            'date' => $now->toDateString(),
            'interns_total' => $interns->count(),
            'holiday' => $today['holiday'],
            'today' => $today['card'],
            'pending_logbooks' => $this->pendingLogbooks($mentor),
            'pending_corrections' => $this->pendingCorrections($mentor),
            'pending_leaves' => $this->pendingLeaves($mentor, $now),
            'ready_to_assess' => $this->readyToAssess($mentor),
            'announcements' => $this->announcements(),
        ];
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function pendingLogbooks(User $mentor): array
    {
        $result = $this->logbooks->list($mentor, MentorLogbooks::TAB_PENDING, null);

        return [
            'total' => $result['counts']['pending_review'],
            'items' => array_values($result['logbooks']->take(self::LIST_LIMIT)->map(fn (Logbook $logbook): array => [
                'id' => $logbook->id,
                'intern' => $this->person($logbook->attendance->intern),
                'date' => $logbook->attendance->date->toDateString(),
                'work' => $logbook->work,
                'is_corrected' => $logbook->attendance->is_corrected,
            ])->all()),
        ];
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function pendingCorrections(User $mentor): array
    {
        $query = AttendanceCorrection::query()
            ->where('mentor_id', $mentor->id)
            ->where('status', CorrectionStatus::PendingMentor)
            ->whereHas('intern');

        return $this->box($query, $query->clone()->with('intern:id,name')->orderBy('created_at')->orderBy('id'), fn (AttendanceCorrection $correction): array => [
            'id' => $correction->id,
            'intern' => $this->person($correction->intern),
            'date' => $correction->date->toDateString(),
            'recorded_status' => $correction->recorded_status->value,
            'recorded_missed_clock_out' => $correction->recorded_missed_clock_out,
            'reason' => $correction->reason,
        ]);
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function pendingLeaves(User $mentor, CarbonInterface $now): array
    {
        $query = LeaveRequest::query()
            ->where('status', RequestStatus::Pending)
            ->whereHas('intern.internProfile', fn (Builder $q) => $q->where('mentor_id', $mentor->id));

        return $this->box($query, $query->clone()->with('intern:id,name')->orderBy('created_at')->orderBy('id'), fn (LeaveRequest $leave): array => [
            'id' => $leave->id,
            'intern' => $this->person($leave->intern),
            'type' => $leave->type->value,
            'start_date' => $leave->start_date->toDateString(),
            'end_date' => $leave->end_date->toDateString(),
            'created_at' => $leave->created_at?->toIso8601String(),
            'pending_hours' => $leave->pendingHours($now),
            'is_overdue' => $leave->isOverduePending($now, $this->settings->leaveEscalationHours()),
        ]);
    }

    /**
     * Intern yang bisa dinilai sekarang (presentasi disetujui, semua logbook disetujui, belum disubmit).
     *
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function readyToAssess(User $mentor): array
    {
        $ready = array_values(array_filter($this->assessments->mentorList($mentor), fn (array $row): bool => $row['can_assess']));

        return [
            'total' => count($ready),
            'items' => array_map(fn (array $row): array => [
                'intern' => $row['intern'],
                'end_date' => $row['end_date'],
                'status' => $row['status'],
            ], array_slice($ready, 0, self::LIST_LIMIT)),
        ];
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $count
     * @param  Builder<TModel>  $ordered
     * @param  callable(TModel): array<string, mixed>  $row
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function box(Builder $count, Builder $ordered, callable $row): array
    {
        $total = $count->count();

        if ($total === 0) {
            return ['total' => 0, 'items' => []];
        }

        return ['total' => $total, 'items' => array_values($ordered->limit(self::LIST_LIMIT)->get()->map($row)->all())];
    }

    /**
     * @return array{id: int, name: string, short_name: string}
     */
    private function person(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'short_name' => $user->shortName()];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function announcements(): array
    {
        return Announcement::query()
            ->with('author:id,name')
            ->where('for_mentor', true)
            ->latest()
            ->latest('id')
            ->limit(self::ANNOUNCEMENT_LIMIT)
            ->get()
            ->map(fn (Announcement $a): array => [
                'id' => $a->id,
                'title' => $a->title,
                'body' => $a->body,
                'author_name' => $a->author?->name,
                'created_at' => $a->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();
    }
}
