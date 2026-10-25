<?php

namespace App\Services;

use App\Enums\AssessmentStatus;
use App\Enums\LogbookStatus;
use App\Enums\PresentationStatus;
use App\Enums\Role;
use App\Exceptions\ActionRejected;
use App\Models\Assessment;
use App\Models\AssessmentIndicator;
use App\Models\AssessmentScore;
use App\Models\Attendance;
use App\Models\FinalPresentation;
use App\Models\InternProfile;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Penilaian akhir oleh mentor saat ini. Terbuka jika presentasi disetujui dan setiap hari yang punya baris presensi
 * dalam periode magang punya logbook disetujui. Setelah submit terkunci permanen, termasuk bagi admin.
 */
class Assessments
{
    public const READY = 'ready';

    public const BLOCKED = 'blocked';

    public const STATUSES = [self::READY, self::BLOCKED, 'draft', 'submitted'];

    public const ALREADY_SUBMITTED = 'Penilaian ini sudah disubmit dan tidak bisa diubah.';

    public const NO_INDICATORS = 'Indikator penilaian belum tersedia. Hubungi admin.';

    public const INCOMPLETE = 'Isi semua nilai sebelum submit.';

    public const NOT_AVAILABLE = 'Penilaian akan tersedia setelah presentasi disetujui, semua logbook disetujui, dan mentor menyelesaikan penilaian.';

    public function __construct(private Notifier $notifier) {}

    /**
     * Ringkasan beberapa intern sekaligus, dengan satu query untuk logbook yang belum disetujui.
     *
     * @param  Collection<int, User>  $interns
     * @return array<int, array<string, mixed>>
     */
    public function summaries(Collection $interns): array
    {
        $interns->loadMissing(['finalPresentation', 'assessment']);
        $unapproved = $this->unapprovedCounts(array_values($interns->modelKeys()));
        $summaries = [];

        foreach ($interns as $intern) {
            $summaries[$intern->id] = $this->summarize($intern->finalPresentation, $intern->assessment, $unapproved[$intern->id] ?? 0);
        }

        return $summaries;
    }

    /**
     * Intern bimbingan mentor saat ini, magang paling cepat berakhir lebih dulu.
     *
     * @return list<array<string, mixed>>
     */
    public function mentorList(User $mentor): array
    {
        return $this->rows($this->mentees($mentor)->get(), false);
    }

    /**
     * Jumlah intern bimbingan yang bisa dinilai sekarang (Siap dinilai atau Draft yang syaratnya terpenuhi).
     */
    public function assessableCount(User $mentor): int
    {
        return count(array_filter(
            $this->summaries($this->mentees($mentor)->get()),
            fn (array $summary): bool => $summary['can_assess'],
        ));
    }

    /**
     * @return array{rows: list<array<string, mixed>>, counts: array<string, int>}
     */
    public function adminList(?string $status, ?int $airportId): array
    {
        $interns = User::query()
            ->where('role', Role::Intern)
            ->whereHas('internProfile', fn (Builder $q) => $q->when($airportId !== null, fn (Builder $a) => $a->where('airport_id', $airportId)))
            ->with(['internProfile.mentor:id,name', 'internProfile.airport:id,name', 'assessment.mentor:id,name'])
            ->get();

        $rows = $this->rows($interns, true);
        $counts = array_fill_keys(self::STATUSES, 0);

        foreach ($rows as $row) {
            $counts[$row['status']]++;
        }

        return [
            'rows' => $status === null ? $rows : array_values(array_filter($rows, fn (array $row): bool => $row['status'] === $status)),
            'counts' => $counts,
        ];
    }

    /**
     * Formulir mentor menampilkan nilai draft; admin hanya melihat nilai setelah submit.
     *
     * @return array<string, mixed>
     */
    public function detail(User $intern, bool $forMentor): array
    {
        $intern->loadMissing([
            'internProfile.mentor:id,name',
            'finalPresentation.decider:id,name',
            'assessment.mentor:id,name',
            'assessment.scores.indicator',
        ]);

        /** @var InternProfile $profile */
        $profile = $intern->internProfile;
        $presentation = $intern->finalPresentation;
        $assessment = $intern->assessment;
        $summary = $this->summaries(new Collection([$intern]))[$intern->id];
        $submitted = $assessment?->isSubmitted() ?? false;
        $indicators = $submitted ? null : $this->activeIndicators();
        $draftScores = $forMentor ? $this->scoreMap($assessment) : [];

        return [
            'intern' => $this->identity($intern),
            'start_date' => $profile->start_date->toDateString(),
            'end_date' => $profile->end_date->toDateString(),
            'presentation' => $presentation === null ? null : [
                'id' => $presentation->id,
                'status' => $presentation->status->value,
                'evidence_url' => $presentation->evidence_url,
                'submitted_at' => $presentation->submitted_at->toIso8601String(),
                'decision_note' => $presentation->decision_note,
                'decided_by' => $presentation->decider?->name,
                'decided_at' => $presentation->decided_at?->toIso8601String(),
            ],
            ...$summary,
            'unapproved_logbook_days' => $submitted ? [] : $this->unapprovedDays($intern, $profile),
            'assessed_by' => $assessment?->mentor?->name,
            'indicators' => $indicators === null
                ? $this->submittedIndicators($assessment)
                : array_values($indicators->map(fn (AssessmentIndicator $indicator): array => [
                    ...$this->indicator($indicator),
                    'score' => $draftScores[$indicator->id] ?? null,
                ])->all()),
            'final_score' => $indicators === null ? $summary['final_score'] : self::finalScore($indicators, $draftScores),
            'can_edit' => $forMentor && $summary['can_assess'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function internView(User $intern): array
    {
        $assessment = $intern->assessment()->with(['mentor:id,name', 'scores.indicator'])->first();

        if ($assessment === null || ! $assessment->isSubmitted()) {
            return ['available' => false, 'message' => self::NOT_AVAILABLE];
        }

        return [
            'available' => true,
            'final_score' => (float) $assessment->final_score,
            'submitted_at' => $assessment->submitted_at?->toIso8601String(),
            'assessed_by' => $assessment->mentor?->name,
            'indicators' => $this->submittedIndicators($assessment),
        ];
    }

    /**
     * Simpan draft atau submit. Syarat dicek ulang di dalam transaksi; profil intern dikunci agar dua penyimpanan
     * bersamaan tidak membuat dua baris atau menimpa penilaian yang baru saja disubmit.
     *
     * @param  array<int, float>  $scores  nilai per id indikator aktif, tanpa nilai kosong
     *
     * @throws ActionRejected
     * @throws ValidationException
     */
    public function save(User $mentor, User $intern, array $scores, bool $submit, CarbonInterface $now): Assessment
    {
        $assessment = DB::transaction(function () use ($mentor, $intern, $scores, $submit, $now): Assessment {
            InternProfile::query()->where('user_id', $intern->id)->lockForUpdate()->firstOrFail();
            $assessment = Assessment::query()->where('intern_id', $intern->id)->lockForUpdate()->first();

            if ($assessment?->isSubmitted()) {
                throw new ActionRejected(self::ALREADY_SUBMITTED, 'already_submitted');
            }

            $blockers = $this->currentBlockers($intern);

            if ($blockers !== []) {
                throw new ActionRejected(
                    'Penilaian belum bisa dilakukan: '.implode(', ', array_column($blockers, 'text')).'.',
                    'not_eligible',
                    ['blockers' => $blockers],
                );
            }

            $indicators = $this->activeIndicators();
            $finalScore = self::finalScore($indicators, $scores);

            if ($submit && $indicators->isEmpty()) {
                throw new ActionRejected(self::NO_INDICATORS, 'no_indicators');
            }

            if ($submit && $finalScore === null) {
                throw ValidationException::withMessages(['scores' => self::INCOMPLETE]);
            }

            $assessment ??= new Assessment(['intern_id' => $intern->id]);
            $assessment->fill([
                'mentor_id' => $mentor->id,
                'status' => $submit ? AssessmentStatus::Submitted : AssessmentStatus::Draft,
                'final_score' => $submit ? $finalScore : null,
                'submitted_at' => $submit ? $now : null,
            ])->save();

            $assessment->scores()->delete();

            foreach ($scores as $indicatorId => $score) {
                $assessment->scores()->create(['indicator_id' => $indicatorId, 'score' => $score]);
            }

            return $assessment;
        });

        if ($submit) {
            $this->notifier->send(
                User::query()->where('role', Role::Admin)->where('is_active', true)->pluck('id')->all(),
                "Penilaian {$intern->shortName()} sudah disubmit.",
                '/penilaian',
                ['open' => $intern->id],
            );
            $this->notifier->send([$intern->id], 'Penilaian akhir Anda sudah tersedia.', '/catatan');
        }

        return $assessment;
    }

    /**
     * Dipanggil setelah kejadian yang bisa membuka penilaian (presentasi disetujui, logbook disetujui).
     * Mengembalikan true jika mentor diberi tahu.
     */
    public function notifyIfReady(User $intern): bool
    {
        $mentorId = $intern->internProfile?->mentor_id;

        if ($mentorId === null
            || Assessment::query()->where('intern_id', $intern->id)->where('status', AssessmentStatus::Submitted)->exists()
            || $this->currentBlockers($intern) !== []) {
            return false;
        }

        $this->notifier->send([$mentorId], "{$intern->shortName()} siap dinilai.", '/penilaian', ['open' => $intern->id]);

        return true;
    }

    /**
     * Rata-rata berbobot jika ada indikator berbobot (indikator tanpa bobot dianggap 0), selain itu rata-rata biasa.
     * Null jika belum ada indikator atau masih ada nilai kosong.
     *
     * @param  Collection<int, AssessmentIndicator>  $indicators
     * @param  array<int, float>  $scores
     */
    public static function finalScore(Collection $indicators, array $scores): ?float
    {
        if ($indicators->isEmpty()) {
            return null;
        }

        $weighted = $indicators->contains(fn (AssessmentIndicator $indicator): bool => (float) $indicator->weight > 0);
        $total = 0.0;
        $weights = 0.0;

        foreach ($indicators as $indicator) {
            if (! isset($scores[$indicator->id])) {
                return null;
            }

            $weight = $weighted ? (float) $indicator->weight : 1.0;
            $total += $scores[$indicator->id] * $weight;
            $weights += $weight;
        }

        return round($total / $weights, 2);
    }

    /**
     * @return Collection<int, AssessmentIndicator>
     */
    public function activeIndicators(): Collection
    {
        return AssessmentIndicator::query()->active()->orderBy('sort_order')->orderBy('id')->get();
    }

    /**
     * @return Builder<User>
     */
    private function mentees(User $mentor): Builder
    {
        return User::query()
            ->where('role', Role::Intern)
            ->whereHas('internProfile', fn (Builder $q) => $q->where('mentor_id', $mentor->id))
            ->with(['internProfile', 'assessment.mentor:id,name']);
    }

    /**
     * @param  Collection<int, User>  $interns
     * @return list<array<string, mixed>>
     */
    private function rows(Collection $interns, bool $forAdmin): array
    {
        $summaries = $this->summaries($interns);

        return array_values($interns
            ->sortBy(fn (User $intern): string => $intern->internProfile?->end_date->toDateString().' '.$intern->name)
            ->map(function (User $intern) use ($summaries, $forAdmin): array {
                $profile = $intern->internProfile;

                return [
                    'intern' => $this->identity($intern),
                    ...($forAdmin ? [
                        'mentor' => $profile === null ? null : ['id' => $profile->mentor->id, 'name' => $profile->mentor->name],
                        'airport' => $profile === null ? null : ['id' => $profile->airport->id, 'name' => $profile->airport->name],
                    ] : []),
                    'end_date' => $profile?->end_date->toDateString(),
                    ...$summaries[$intern->id],
                    'assessed_by' => $intern->assessment?->mentor?->name,
                ];
            })
            ->all());
    }

    /**
     * @return array<string, mixed>
     */
    private function summarize(?FinalPresentation $presentation, ?Assessment $assessment, int $unapproved): array
    {
        $submitted = $assessment?->isSubmitted() ?? false;
        $blockers = $submitted ? [] : $this->blockers($presentation, $unapproved);

        return [
            'presentation_status' => $presentation?->status->value,
            'unapproved_logbooks' => $unapproved,
            'status' => match (true) {
                $submitted => AssessmentStatus::Submitted->value,
                $assessment !== null => AssessmentStatus::Draft->value,
                $blockers === [] => self::READY,
                default => self::BLOCKED,
            },
            'blockers' => $blockers,
            'can_assess' => ! $submitted && $blockers === [],
            'final_score' => $submitted ? (float) $assessment->final_score : null,
            'submitted_at' => $assessment?->submitted_at?->toIso8601String(),
        ];
    }

    /**
     * @return list<array{code: string, text: string}>
     */
    private function blockers(?FinalPresentation $presentation, int $unapproved): array
    {
        $blockers = [];

        if ($presentation?->status !== PresentationStatus::Approved) {
            $blockers[] = [
                'code' => 'presentation',
                'text' => $presentation === null ? 'presentasi akhir belum dikirim' : 'presentasi akhir belum disetujui',
            ];
        }

        if ($unapproved > 0) {
            $blockers[] = ['code' => 'logbooks', 'text' => "{$unapproved} logbook belum disetujui"];
        }

        return $blockers;
    }

    /**
     * @return list<array{code: string, text: string}>
     */
    private function currentBlockers(User $intern): array
    {
        return $this->blockers(
            FinalPresentation::query()->where('intern_id', $intern->id)->first(),
            $this->unapprovedCounts([$intern->id])[$intern->id] ?? 0,
        );
    }

    /**
     * Hari wajib berlogbook = hari dalam periode magang yang punya baris presensi. Dihitung yang logbooknya
     * belum ada atau belum disetujui.
     *
     * @param  list<int>  $internIds
     * @return array<int, int>
     */
    private function unapprovedCounts(array $internIds): array
    {
        if ($internIds === []) {
            return [];
        }

        return $this->requiredDays()
            ->whereIn('attendances.intern_id', $internIds)
            ->where(fn (Builder $q) => $q->whereNull('logbooks.id')->orWhere('logbooks.status', '!=', LogbookStatus::Approved))
            ->groupBy('attendances.intern_id')
            ->selectRaw('attendances.intern_id, COUNT(*) AS total')
            ->pluck('total', 'intern_id')
            ->map(intval(...))
            ->all();
    }

    /**
     * Untuk tautan "2 logbook belum disetujui". `logbook_id` hanya diisi jika logbook sudah dikirim, karena draft
     * tidak terlihat oleh mentor.
     *
     * @return list<array{date: string, status: string, logbook_id: int|null}>
     */
    private function unapprovedDays(User $intern, InternProfile $profile): array
    {
        return array_values(Attendance::query()
            ->with('logbook:id,attendance_id,status')
            ->where('intern_id', $intern->id)
            ->whereDate('date', '>=', $profile->start_date->toDateString())
            ->whereDate('date', '<=', $profile->end_date->toDateString())
            ->whereDoesntHave('logbook', fn (Builder $q) => $q->where('status', LogbookStatus::Approved))
            ->orderBy('date')
            ->get()
            ->map(fn (Attendance $attendance): array => [
                'date' => $attendance->date->toDateString(),
                'status' => $attendance->logbook === null ? 'missing' : $attendance->logbook->status->value,
                'logbook_id' => $attendance->logbook === null || $attendance->logbook->status === LogbookStatus::Draft
                    ? null
                    : $attendance->logbook->id,
            ])
            ->all());
    }

    /**
     * @return Builder<Attendance>
     */
    private function requiredDays(): Builder
    {
        return Attendance::query()
            ->join('intern_profiles', 'intern_profiles.user_id', '=', 'attendances.intern_id')
            ->leftJoin('logbooks', 'logbooks.attendance_id', '=', 'attendances.id')
            ->whereColumn('attendances.date', '>=', 'intern_profiles.start_date')
            ->whereColumn('attendances.date', '<=', 'intern_profiles.end_date');
    }

    /**
     * @return array<int, float>
     */
    private function scoreMap(?Assessment $assessment): array
    {
        if ($assessment === null) {
            return [];
        }

        return $assessment->scores->mapWithKeys(fn (AssessmentScore $score): array => [$score->indicator_id => (float) $score->score])->all();
    }

    /**
     * Nilai tersimpan dengan indikator saat submit, walau indikatornya kemudian dinonaktifkan.
     *
     * @return list<array<string, mixed>>
     */
    private function submittedIndicators(?Assessment $assessment): array
    {
        if ($assessment === null) {
            return [];
        }

        return array_values($assessment->scores
            ->sortBy(fn (AssessmentScore $score): string => sprintf('%010d-%010d', $score->indicator->sort_order, $score->indicator_id))
            ->map(fn (AssessmentScore $score): array => [...$this->indicator($score->indicator), 'score' => (float) $score->score])
            ->all());
    }

    /**
     * @return array{id: int, name: string, description: string|null, weight: float|null}
     */
    private function indicator(AssessmentIndicator $indicator): array
    {
        return [
            'id' => $indicator->id,
            'name' => $indicator->name,
            'description' => $indicator->description,
            'weight' => $indicator->weight === null ? null : (float) $indicator->weight,
        ];
    }

    /**
     * @return array{id: int, name: string, short_name: string}
     */
    private function identity(User $intern): array
    {
        return ['id' => $intern->id, 'name' => $intern->name, 'short_name' => $intern->shortName()];
    }
}
