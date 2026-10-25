<?php

namespace App\Services;

use App\Enums\TaskStatus;
use App\Models\Task;
use Carbon\CarbonInterface;

/**
 * "Lebih dari 2 hari kerja" dihitung dari hari kerja setelah tanggal tenggat sampai hari ini:
 * tenggat Jumat 9 Okt, pengingat dikirim Rabu 14 Okt (Senin, Selasa, Rabu = 3 hari kerja).
 */
class OverdueTaskReminders
{
    public const WORKING_DAYS = 2;

    public function __construct(
        private AttendanceCalendar $calendar,
        private AccountAccess $access,
        private Notifier $notifier,
    ) {}

    public function send(CarbonInterface $now): int
    {
        $today = $now->toDateString();
        $sent = 0;

        $tasks = Task::query()
            ->whereIn('status', [TaskStatus::Todo, TaskStatus::InProgress])
            ->whereNull('overdue_reminded_at')
            ->whereNotNull('mentor_id')
            ->whereDate('due_at', '<', $today)
            ->whereHas('intern')
            ->with('intern.internProfile')
            ->orderBy('id')
            ->get();

        foreach ($tasks as $task) {
            // Intern nonaktif tidak bisa mengumpulkan, jadi pengingat tidak berguna.
            if ($this->access->denialReason($task->intern, $now) !== null) {
                continue;
            }

            $daysLate = $this->calendar->workingDays($task->due_at->copy()->addDay()->toDateString(), $today);

            if ($daysLate <= self::WORKING_DAYS) {
                continue;
            }

            // Update bersyarat agar dua proses scheduler tidak mengirim dua kali.
            $claimed = Task::query()->whereKey($task->id)->whereNull('overdue_reminded_at')->update(['overdue_reminded_at' => $now]);

            if ($claimed === 0) {
                continue;
            }

            $this->notifier->send(
                [(int) $task->mentor_id],
                "Task '{$task->title}' milik {$task->intern->shortName()} lewat tenggat lebih dari 2 hari kerja.",
                '/task',
                ['open' => $task->id],
            );

            $sent++;
        }

        return $sent;
    }
}
