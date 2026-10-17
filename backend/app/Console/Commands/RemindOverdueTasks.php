<?php

namespace App\Console\Commands;

use App\Services\OverdueTaskReminders;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Date;

/**
 * Dijalankan scheduler setiap hari (routes/console.php). Aman dijalankan berulang: tiap Task hanya diingatkan sekali.
 */
class RemindOverdueTasks extends Command
{
    protected $signature = 'app:remind-overdue-tasks';

    protected $description = 'Ingatkan mentor tentang Task yang lewat tenggat lebih dari 2 hari kerja tanpa dikumpulkan';

    public function handle(OverdueTaskReminders $reminders): int
    {
        $sent = $reminders->send(Date::now());

        $this->info("{$sent} pengingat Task terlambat dikirim.");

        return self::SUCCESS;
    }
}
