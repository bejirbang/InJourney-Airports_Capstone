<?php

namespace App\Services;

use App\Enums\TaskStatus;
use App\Enums\TodayState;
use App\Models\Announcement;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonInterface;

/**
 * Isi Dashboard Intern (docs/design-intern.md, Alur 2).
 * Semua data hanya milik intern yang login.
 */
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
            // Banner: sudah clock in tetapi Daily Report hari ini belum terkirim.
            'daily_report_reminder' => $today['state'] === TodayState::ClockedIn && ! $today['daily_report_sent'],
            'monthly_recap' => $this->calendar->monthlyRecap($intern, $now),
            'tasks' => $this->tasks($intern, $now),
            'internship' => $profile === null ? null : [
                'start_date' => $profile->start_date->toDateString(),
                'end_date' => $profile->end_date->toDateString(),
                'mentor' => ['id' => $profile->mentor->id, 'name' => $profile->mentor->name],
            ],
            'announcements' => $this->announcements(),
        ];
    }

    /**
     * Jumlah Task aktif per status, jumlah Terlambat, dan tenggat terdekat.
     * `total` ikut menghitung Task Done, untuk membedakan "Belum ada Task dari mentor".
     *
     * @return array<string, mixed>
     */
    private function tasks(User $intern, CarbonInterface $now): array
    {
        $tasks = $intern->assignedTasks()->orderBy('due_at')->orderBy('id')->get();
        $active = $tasks->reject(fn (Task $task): bool => $task->status === TaskStatus::Done)->values();
        $count = fn (TaskStatus $status): int => $active->where('status', $status)->count();

        // Tenggat terdekat yang belum lewat; jika semua sudah lewat, yang paling lama terlambat.
        $nearest = $active->first(fn (Task $task): bool => $task->due_at->gte($now)) ?? $active->first();

        return [
            'total' => $tasks->count(),
            'todo' => $count(TaskStatus::Todo),
            'in_progress' => $count(TaskStatus::InProgress),
            'in_review' => $count(TaskStatus::InReview),
            'late' => $active->filter(fn (Task $task): bool => $task->isLate($now))->count(),
            'nearest' => $nearest === null ? null : [
                'id' => $nearest->id,
                'code' => $nearest->code,
                'title' => $nearest->title,
                'status' => $nearest->status->value,
                'due_at' => $nearest->due_at->toIso8601String(),
                'is_late' => $nearest->isLate($now),
            ],
        ];
    }

    /**
     * Pengumuman terbaru untuk role Intern.
     *
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
