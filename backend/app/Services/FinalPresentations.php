<?php

namespace App\Services;

use App\Enums\PresentationStatus;
use App\Enums\Role;
use App\Exceptions\ActionRejected;
use App\Models\AuditLog;
use App\Models\FinalPresentation;
use App\Models\InternProfile;
use App\Models\User;
use App\Support\IndonesianDate;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Bukti presentasi akhir: intern mengirim link mulai H-`end_reminder_days` dan boleh menggantinya sampai disetujui.
 * Hanya admin yang memverifikasi. Yang sudah disetujui tetap disetujui walau magang diperpanjang.
 */
class FinalPresentations
{
    public const NOT_OPEN = 'not_open';

    public const NOT_SUBMITTED = 'not_submitted';

    public const TABS = ['pending', 'revision', 'approved', self::NOT_SUBMITTED];

    public const ALREADY_APPROVED = 'Presentasi akhir sudah disetujui.';

    public function __construct(
        private SystemSettings $settings,
        private Assessments $assessments,
        private Notifier $notifier,
    ) {}

    public function opensOn(InternProfile $profile): CarbonInterface
    {
        return $profile->end_date->copy()->subDays($this->settings->endReminderDays());
    }

    /**
     * @return array<string, mixed>
     */
    public function forIntern(User $intern, CarbonInterface $now): array
    {
        /** @var InternProfile $profile */
        $profile = $intern->internProfile;
        $presentation = $intern->finalPresentation()->with('decider:id,name')->first();
        $opensOn = $this->opensOn($profile);
        $state = $this->state($presentation, $opensOn, $now);

        return [
            'state' => $state,
            'end_date' => $profile->end_date->toDateString(),
            'days_left' => $profile->daysLeft($now),
            'opens_on' => $opensOn->toDateString(),
            'message' => $state === self::NOT_OPEN ? $this->notOpenMessage($opensOn) : null,
            'evidence_url' => $presentation?->evidence_url,
            'submitted_at' => $presentation?->submitted_at->toIso8601String(),
            'decision_note' => $presentation?->decision_note,
            'decided_at' => $presentation?->decided_at?->toIso8601String(),
            'can_submit' => $state !== self::NOT_OPEN && $state !== PresentationStatus::Approved->value,
        ];
    }

    /**
     * Banner Dashboard intern: sejak formulir terbuka sampai presentasi disetujui.
     *
     * @return array{state: string, end_date: string, days_left: int}|null
     */
    public function banner(User $intern, CarbonInterface $now): ?array
    {
        $profile = $intern->internProfile;

        if ($profile === null) {
            return null;
        }

        $state = $this->state($intern->finalPresentation, $this->opensOn($profile), $now);

        if ($state === self::NOT_OPEN || $state === PresentationStatus::Approved->value) {
            return null;
        }

        return ['state' => $state, 'end_date' => $profile->end_date->toDateString(), 'days_left' => $profile->daysLeft($now)];
    }

    /**
     * Profil intern dikunci agar dua kiriman bersamaan tidak membuat dua baris dan tidak menimpa keputusan admin.
     * Admin hanya diberi tahu saat bukti masuk antrean (kiriman pertama atau setelah revisi), bukan setiap ganti link.
     *
     * @throws ActionRejected
     */
    public function submit(User $intern, string $evidenceUrl, CarbonInterface $now): FinalPresentation
    {
        [$presentation, $queued] = DB::transaction(function () use ($intern, $evidenceUrl, $now): array {
            $profile = InternProfile::query()->where('user_id', $intern->id)->lockForUpdate()->firstOrFail();
            $presentation = FinalPresentation::query()->where('intern_id', $intern->id)->lockForUpdate()->first();
            $opensOn = $this->opensOn($profile);

            if ($presentation === null && $now->toDateString() < $opensOn->toDateString()) {
                throw new ActionRejected($this->notOpenMessage($opensOn), self::NOT_OPEN);
            }

            if ($presentation?->status === PresentationStatus::Approved) {
                throw new ActionRejected(self::ALREADY_APPROVED, 'already_approved');
            }

            $queued = $presentation?->status !== PresentationStatus::Pending;
            $presentation ??= new FinalPresentation(['intern_id' => $intern->id]);

            $presentation->fill([
                'evidence_url' => $evidenceUrl,
                'status' => PresentationStatus::Pending,
                'submitted_at' => $now,
                'decided_by' => null,
                'decision_note' => null,
                'decided_at' => null,
            ])->save();

            return [$presentation, $queued];
        });

        if ($queued) {
            $this->notifier->send(
                User::query()->where('role', Role::Admin)->where('is_active', true)->pluck('id')->all(),
                "{$intern->shortName()} mengirim bukti presentasi akhir.",
                '/presentasi',
                ['open' => $presentation->id],
            );
        }

        return $presentation;
    }

    /**
     * Menunggu dari kiriman terlama; Revisi dan Disetujui dari keputusan terbaru; Belum kirim berisi intern yang
     * formulirnya sudah terbuka, magangnya belum berakhir, dan belum mengirim.
     *
     * @return array{rows: list<array<string, mixed>>, counts: array<string, int>}
     */
    public function adminList(?string $tab, ?int $airportId, CarbonInterface $now): array
    {
        $tab ??= PresentationStatus::Pending->value;

        $rows = $tab === self::NOT_SUBMITTED
            ? array_values($this->notSubmittedQuery($airportId, $now)
                ->with(['user', 'mentor:id,name', 'airport:id,name'])
                ->get()
                ->sortBy(fn (InternProfile $profile): string => $profile->end_date->toDateString().' '.$profile->user->name)
                ->map(fn (InternProfile $profile): array => $this->row(null, $profile, $now))
                ->all())
            : array_values($this->submittedQuery($airportId)
                ->with(['intern.internProfile.mentor:id,name', 'intern.internProfile.airport:id,name', 'decider:id,name'])
                ->where('status', $tab)
                ->when(
                    $tab === PresentationStatus::Pending->value,
                    fn (Builder $q) => $q->orderBy('submitted_at')->orderBy('id'),
                    fn (Builder $q) => $q->orderByDesc('decided_at')->orderByDesc('id'),
                )
                ->get()
                ->map(fn (FinalPresentation $presentation): array => $this->detail($presentation, $now))
                ->all());

        $counts = [];

        foreach ([PresentationStatus::Pending, PresentationStatus::Revision, PresentationStatus::Approved] as $status) {
            $counts[$status->value] = $this->submittedQuery($airportId)->where('status', $status)->count();
        }

        $counts[self::NOT_SUBMITTED] = $this->notSubmittedQuery($airportId, $now)->count();

        return ['rows' => $rows, 'counts' => $counts];
    }

    public function pendingCount(): int
    {
        return $this->submittedQuery(null)->where('status', PresentationStatus::Pending)->count();
    }

    /**
     * @return array<string, mixed>
     */
    public function detail(FinalPresentation $presentation, CarbonInterface $now): array
    {
        $presentation->loadMissing(['intern.internProfile.mentor:id,name', 'intern.internProfile.airport:id,name', 'decider:id,name']);

        /** @var InternProfile $profile */
        $profile = $presentation->intern->internProfile;

        return $this->row($presentation, $profile, $now);
    }

    /**
     * @throws ActionRejected
     */
    public function approve(User $admin, FinalPresentation $presentation, CarbonInterface $now): FinalPresentation
    {
        $presentation = $this->decide($admin, $presentation, PresentationStatus::Approved, null, $now);
        $intern = $presentation->intern;

        $this->notifier->send([$intern->id], 'Presentasi akhir Anda disetujui.', '/presentasi');

        $mentorId = $intern->internProfile?->mentor_id;

        // "Siap dinilai" sudah menyiratkan presentasi disetujui, jadi mentor cukup menerima satu notifikasi.
        if ($mentorId !== null && ! $this->assessments->notifyIfReady($intern)) {
            $this->notifier->send([$mentorId], "Presentasi akhir {$intern->shortName()} disetujui.", '/penilaian', ['open' => $intern->id]);
        }

        return $presentation;
    }

    /**
     * @throws ActionRejected
     */
    public function requestRevision(User $admin, FinalPresentation $presentation, string $note, CarbonInterface $now): FinalPresentation
    {
        $presentation = $this->decide($admin, $presentation, PresentationStatus::Revision, $note, $now);

        $this->notifier->send([$presentation->intern_id], 'Bukti presentasi perlu diperbaiki.', '/presentasi');

        return $presentation;
    }

    /**
     * Hanya bukti yang sedang Menunggu yang bisa diputuskan. Baris dikunci agar admin lain atau intern yang
     * mengganti link pada saat yang sama tidak tertimpa.
     *
     * @throws ActionRejected
     */
    private function decide(User $admin, FinalPresentation $presentation, PresentationStatus $status, ?string $note, CarbonInterface $now): FinalPresentation
    {
        return DB::transaction(function () use ($admin, $presentation, $status, $note, $now): FinalPresentation {
            $presentation = FinalPresentation::query()->with(['intern.internProfile', 'decider:id,name'])->lockForUpdate()->findOrFail($presentation->id);

            if ($presentation->status !== PresentationStatus::Pending) {
                throw new ActionRejected('Data ini sudah diproses oleh '.($presentation->decider->name ?? 'pihak lain').'.', 'already_processed');
            }

            $presentation->update([
                'status' => $status,
                'decided_by' => $admin->id,
                'decision_note' => $note,
                'decided_at' => $now,
            ]);

            AuditLog::record(
                $admin,
                AuditLog::ACTION_PRESENTATION,
                $presentation->intern->name,
                $status === PresentationStatus::Approved ? 'Setujui bukti presentasi akhir.' : 'Minta revisi bukti presentasi akhir.',
            );

            return $presentation->load('decider:id,name');
        });
    }

    private function state(?FinalPresentation $presentation, CarbonInterface $opensOn, CarbonInterface $now): string
    {
        if ($presentation !== null) {
            return $presentation->status->value;
        }

        return $now->toDateString() < $opensOn->toDateString() ? self::NOT_OPEN : self::NOT_SUBMITTED;
    }

    private function notOpenMessage(CarbonInterface $opensOn): string
    {
        return 'Presentasi akhir dapat dikirim mulai '.IndonesianDate::withYear($opensOn).'.';
    }

    /**
     * @return array<string, mixed>
     */
    private function row(?FinalPresentation $presentation, InternProfile $profile, CarbonInterface $now): array
    {
        $intern = $presentation->intern ?? $profile->user;

        return [
            'id' => $presentation?->id,
            'intern' => ['id' => $intern->id, 'name' => $intern->name, 'short_name' => $intern->shortName()],
            'mentor' => ['id' => $profile->mentor->id, 'name' => $profile->mentor->name],
            'airport' => ['id' => $profile->airport->id, 'name' => $profile->airport->name],
            'end_date' => $profile->end_date->toDateString(),
            'days_left' => $profile->daysLeft($now),
            'status' => $presentation === null ? self::NOT_SUBMITTED : $presentation->status->value,
            'evidence_url' => $presentation?->evidence_url,
            'submitted_at' => $presentation?->submitted_at->toIso8601String(),
            'decision_note' => $presentation?->decision_note,
            'decided_by' => $presentation?->decider?->name,
            'decided_at' => $presentation?->decided_at?->toIso8601String(),
            'can_decide' => $presentation?->status === PresentationStatus::Pending,
        ];
    }

    /**
     * @return Builder<FinalPresentation>
     */
    private function submittedQuery(?int $airportId): Builder
    {
        return FinalPresentation::query()
            ->whereHas('intern.internProfile', fn (Builder $q) => $q->when($airportId !== null, fn (Builder $a) => $a->where('airport_id', $airportId)));
    }

    /**
     * @return Builder<InternProfile>
     */
    private function notSubmittedQuery(?int $airportId, CarbonInterface $now): Builder
    {
        $today = $now->toDateString();

        return InternProfile::query()
            ->whereHas('user', fn (Builder $q) => $q->where('role', Role::Intern)->where('is_active', true)->whereDoesntHave('finalPresentation'))
            ->whereDate('start_date', '<=', $today)
            ->whereDate('end_date', '>=', $today)
            ->whereDate('end_date', '<=', Carbon::parse($today)->addDays($this->settings->endReminderDays())->toDateString())
            ->when($airportId !== null, fn (Builder $q) => $q->where('airport_id', $airportId));
    }
}
