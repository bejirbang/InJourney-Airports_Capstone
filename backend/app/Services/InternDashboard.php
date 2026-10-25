<?php

namespace App\Services;

use App\Enums\TodayState;
use App\Models\Announcement;
use App\Models\User;
use Carbon\CarbonInterface;

class InternDashboard
{
    public const ANNOUNCEMENT_LIMIT = 3;

    public function __construct(private AttendanceCalendar $calendar) {}

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
            'today' => [...$today, 'state' => $today['state']->value],
            'daily_report_reminder' => $today['state'] === TodayState::ClockedIn && ! $today['daily_report_sent'],
            'monthly_recap' => $this->calendar->monthlyRecap($intern, $now),
            'internship' => $profile === null ? null : [
                'start_date' => $profile->start_date->toDateString(),
                'end_date' => $profile->end_date->toDateString(),
                'mentor' => ['id' => $profile->mentor->id, 'name' => $profile->mentor->name],
            ],
            'announcements' => $this->announcements(),
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
