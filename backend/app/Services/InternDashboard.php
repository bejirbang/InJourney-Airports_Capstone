<?php

namespace App\Services;

use App\Enums\CorrectionStatus;
use App\Enums\RequestStatus;
use App\Enums\TodayState;
use App\Models\Announcement;
use App\Models\AttendanceCorrection;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Models\Warning;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

class InternDashboard
{
    public const ANNOUNCEMENT_LIMIT = 3;

    /** Warning dan hasil koreksi/izin yang masih dianggap baru di "Perlu ditindak". */
    public const RECENT_DAYS = 7;

    public function __construct(
        private AttendanceCalendar $calendar,
        private InternLogbooks $logbooks,
        private LeaveQuotas $quotas,
        private FinalPresentations $presentations,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function for(User $intern, CarbonInterface $now): array
    {
        $intern->loadMissing('internProfile.mentor');
        $profile = $intern->internProfile;
        $today = $this->calendar->today($intern, $now);

        return [
            'date' => $now->toDateString(),
            'presentation_banner' => $this->presentations->banner($intern, $now),
            'today' => [...$today, 'state' => $today['state']->value],
            'logbook_reminder' => $today['state'] === TodayState::ClockedIn && $today['logbook'] === null,
            'action_needed' => [
                'logbooks' => $this->logbooks->actionNeeded($intern),
                ...$this->recent($intern, $now),
            ],
            'monthly_recap' => $this->calendar->monthlyRecap($intern, $now),
            'leave_quota' => $this->quotas->summary($intern),
            'internship' => $profile === null ? null : [
                'start_date' => $profile->start_date->toDateString(),
                'end_date' => $profile->end_date->toDateString(),
                'mentor' => ['id' => $profile->mentor->id, 'name' => $profile->mentor->name],
            ],
            'announcements' => $this->announcements(),
        ];
    }

    /**
     * Warning baru serta koreksi dan izin yang baru diputuskan (final), terbaru lebih dulu.
     *
     * @return array{warnings: list<array<string, mixed>>, corrections: list<array<string, mixed>>, leaves: list<array<string, mixed>>}
     */
    private function recent(User $intern, CarbonInterface $now): array
    {
        $since = $now->copy()->subDays(self::RECENT_DAYS);

        $corrections = $intern->attendanceCorrections()
            ->whereIn('status', [CorrectionStatus::Approved, CorrectionStatus::RejectedByMentor, CorrectionStatus::RejectedByAdmin])
            ->where(fn (Builder $q) => $q->where('admin_decided_at', '>=', $since)
                ->orWhere(fn (Builder $m) => $m->where('status', CorrectionStatus::RejectedByMentor)->where('mentor_decided_at', '>=', $since)))
            ->get()
            ->map(fn (AttendanceCorrection $c): array => [
                'id' => $c->id,
                'date' => $c->date->toDateString(),
                'status' => $c->status->value,
                'decided_at' => ($c->admin_decided_at ?? $c->mentor_decided_at)?->toIso8601String(),
            ])
            ->sortByDesc('decided_at');

        return [
            'warnings' => array_values($intern->warnings()
                ->where('created_at', '>=', $since)
                ->latest()
                ->latest('id')
                ->get()
                ->map(fn (Warning $w): array => ['id' => $w->id, 'created_at' => $w->created_at?->toIso8601String()])
                ->all()),
            'corrections' => array_values($corrections->all()),
            'leaves' => array_values($intern->leaveRequests()
                ->whereIn('status', [RequestStatus::Approved, RequestStatus::Rejected])
                ->where('decided_at', '>=', $since)
                ->orderByDesc('decided_at')
                ->orderByDesc('id')
                ->get()
                ->map(fn (LeaveRequest $l): array => [
                    'id' => $l->id,
                    'type' => $l->type->value,
                    'start_date' => $l->start_date->toDateString(),
                    'end_date' => $l->end_date->toDateString(),
                    'status' => $l->status->value,
                    'decided_at' => $l->decided_at?->toIso8601String(),
                ])
                ->all()),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function announcements(): array
    {
        return Announcement::query()
            ->with('author:id,name')
            ->where('for_intern', true)
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
