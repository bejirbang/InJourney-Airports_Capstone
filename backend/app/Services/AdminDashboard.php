<?php

namespace App\Services;

use App\Enums\AssessmentStatus;
use App\Enums\CorrectionStatus;
use App\Enums\PresentationStatus;
use App\Enums\Role;
use App\Models\Airport;
use App\Models\Assessment;
use App\Models\AttendanceCorrection;
use App\Models\FinalPresentation;
use App\Models\InternProfile;
use App\Models\LeaveRequest;
use App\Models\Office;
use App\Models\User;
use App\Support\DaySchedule;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Dashboard admin. Filter bandara (`airport_id`, kosong = semua) mengubah seluruh isi. Kotak tindakan menampilkan
 * maksimal lima baris dan jumlah totalnya.
 */
class AdminDashboard
{
    public const LIST_LIMIT = 5;

    /** Penilaian yang disubmit dalam sekian hari terakhir tampil di "Penilaian baru masuk". */
    public const NEW_ASSESSMENT_DAYS = 7;

    public function __construct(
        private EndingInternships $endings,
        private SystemSettings $settings,
        private DashboardCards $cards,
        private LeaveQuotas $quotas,
        private WorkSchedules $schedules,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function for(CarbonInterface $now, ?int $airportId): array
    {
        $date = $now->toDateString();
        $interns = $this->activeInterns($date, $airportId);
        $today = $this->cards->today($interns, $now);

        // Bandara terpilih (atau semua bandara aktif) libur hari ini, termasuk saat belum ada intern di sana.
        if ($today['holiday'] === null) {
            $airportIds = $airportId !== null ? [$airportId] : Airport::query()->active()->pluck('id')->all();
            $schedules = array_map(fn (int $id): DaySchedule => $this->schedules->forDate($id, $date), $airportIds);

            if ($schedules !== [] && array_filter($schedules, fn (DaySchedule $day): bool => $day->isWorkday) === []) {
                $today = ['holiday' => ['name' => $schedules[0]->holidayName], 'card' => null];
            }
        }

        return [
            'date' => $date,
            'airport_id' => $airportId,
            'holiday' => $today['holiday'],
            'has_active_office' => Office::query()->active()->when($airportId !== null, fn (Builder $q) => $q->where('airport_id', $airportId))->exists(),
            'today' => $today['card'],
            'yesterday' => $this->cards->previousDay($this->recentInterns($now, $airportId), $now),
            'pending_corrections' => $this->pendingCorrections($airportId),
            'overdue_leaves' => $this->overdueLeaves($now, $airportId),
            'pending_presentations' => $this->pendingPresentations($airportId),
            'ending_internships' => $this->endingInternships($now, $airportId),
            'quota_exhausted' => $this->quotaExhausted($date, $airportId),
            'new_assessments' => $this->newAssessments($now, $airportId),
            'campuses' => $this->campuses($interns),
        ];
    }

    /**
     * Intern aktif yang sedang dalam periode magang pada tanggal itu.
     *
     * @return Collection<int, User>
     */
    private function activeInterns(string $date, ?int $airportId): Collection
    {
        return User::query()
            ->where('role', Role::Intern)
            ->where('is_active', true)
            ->whereHas('internProfile', fn (Builder $q) => $this->inPeriod($q, $date, $airportId))
            ->with('internProfile')
            ->get();
    }

    /**
     * Akun intern aktif yang magangnya belum lama berakhir, untuk ringkasan hari kerja sebelumnya (periode dicek per
     * tanggal oleh AttendanceCalendar::statusesOn).
     *
     * @return Collection<int, User>
     */
    private function recentInterns(CarbonInterface $now, ?int $airportId): Collection
    {
        return User::query()
            ->where('role', Role::Intern)
            ->where('is_active', true)
            ->whereHas('internProfile', fn (Builder $q) => $q
                ->whereDate('end_date', '>=', $now->copy()->subDays(DashboardCards::LOOKBACK_DAYS)->toDateString())
                ->when($airportId !== null, fn (Builder $a) => $a->where('airport_id', $airportId)))
            ->with('internProfile')
            ->get();
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function pendingCorrections(?int $airportId): array
    {
        $query = $this->forAirport(AttendanceCorrection::query()->where('status', CorrectionStatus::PendingAdmin), $airportId);

        return $this->box($query, $query->clone()->with('intern:id,name')->orderBy('mentor_decided_at')->orderBy('id'), fn (AttendanceCorrection $correction): array => [
            'id' => $correction->id,
            'intern' => $this->person($correction->intern),
            'date' => $correction->date->toDateString(),
            'recorded_status' => $correction->recorded_status->value,
            'recorded_missed_clock_out' => $correction->recorded_missed_clock_out,
            'mentor_decided_at' => $correction->mentor_decided_at?->toIso8601String(),
        ]);
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function overdueLeaves(CarbonInterface $now, ?int $airportId): array
    {
        $query = $this->forAirport(LeaveRequest::query()->overduePending($now, $this->settings->leaveEscalationHours()), $airportId);

        return $this->box($query, $query->clone()->with('intern:id,name')->orderBy('created_at')->orderBy('id'), fn (LeaveRequest $leave): array => [
            'id' => $leave->id,
            'intern' => $this->person($leave->intern),
            'type' => $leave->type->value,
            'start_date' => $leave->start_date->toDateString(),
            'end_date' => $leave->end_date->toDateString(),
            'created_at' => $leave->created_at?->toIso8601String(),
            'pending_hours' => $leave->pendingHours($now),
        ]);
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function pendingPresentations(?int $airportId): array
    {
        $query = $this->forAirport(FinalPresentation::query()->where('status', PresentationStatus::Pending), $airportId);

        return $this->box($query, $query->clone()->with('intern:id,name')->orderBy('submitted_at')->orderBy('id'), fn (FinalPresentation $presentation): array => [
            'id' => $presentation->id,
            'intern' => $this->person($presentation->intern),
            'evidence_url' => $presentation->evidence_url,
            'submitted_at' => $presentation->submitted_at->toIso8601String(),
        ]);
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function endingInternships(CarbonInterface $now, ?int $airportId): array
    {
        return $this->box(
            $this->endings->query($now, $airportId),
            $this->endings->ordered($now, $airportId),
            fn (InternProfile $profile): array => $this->endings->row($profile, $now),
        );
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function quotaExhausted(string $date, ?int $airportId): array
    {
        $query = User::query()
            ->where('role', Role::Intern)
            ->where('is_active', true)
            ->whereHas('internProfile', fn (Builder $q) => $this->inPeriod($q, $date, $airportId))
            ->whereIn('id', $this->quotas->exhaustedInternIds());

        return $this->box($query, $query->clone()->with('internProfile')->orderBy('name')->orderBy('id'), fn (User $intern): array => [
            'intern' => $this->person($intern),
            'quota' => $this->quotas->summary($intern),
        ]);
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function newAssessments(CarbonInterface $now, ?int $airportId): array
    {
        $query = $this->forAirport(Assessment::query()
            ->where('status', AssessmentStatus::Submitted)
            ->where('submitted_at', '>=', $now->copy()->subDays(self::NEW_ASSESSMENT_DAYS)), $airportId);

        return $this->box($query, $query->clone()->with(['intern:id,name', 'mentor:id,name'])->orderByDesc('submitted_at')->orderByDesc('id'), fn (Assessment $assessment): array => [
            'intern' => $this->person($assessment->intern),
            'final_score' => (float) $assessment->final_score,
            'assessed_by' => $assessment->mentor?->name,
            'submitted_at' => $assessment->submitted_at?->toIso8601String(),
        ]);
    }

    /**
     * Jumlah intern aktif per universitas, terbanyak lebih dulu.
     *
     * @param  Collection<int, User>  $interns
     * @return list<array{university: string, total: int}>
     */
    private function campuses(Collection $interns): array
    {
        return array_values($interns
            ->countBy(fn (User $intern): string => (string) $intern->internProfile?->university)
            ->map(fn (int $total, string $university): array => ['university' => $university, 'total' => $total])
            ->sortBy([['total', 'desc'], ['university', 'asc']])
            ->all());
    }

    /**
     * @param  Builder<InternProfile>  $query
     * @return Builder<InternProfile>
     */
    private function inPeriod(Builder $query, string $date, ?int $airportId): Builder
    {
        return $query
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->when($airportId !== null, fn (Builder $q) => $q->where('airport_id', $airportId));
    }

    /**
     * Data milik intern yang belum dihapus, dibatasi bandara intern jika filter dipilih.
     *
     * @template TModel of AttendanceCorrection|LeaveRequest|FinalPresentation|Assessment
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function forAirport(Builder $query, ?int $airportId): Builder
    {
        return $query->whereHas('intern.internProfile', fn (Builder $q) => $q->when($airportId !== null, fn (Builder $a) => $a->where('airport_id', $airportId)));
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
}
