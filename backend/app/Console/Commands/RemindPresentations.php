<?php

namespace App\Console\Commands;

use App\Services\PresentationReminders;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Date;

class RemindPresentations extends Command
{
    protected $signature = 'app:remind-presentations';

    protected $description = 'Ingatkan intern untuk presentasi akhir dan mengirim buktinya (end_reminder_days)';

    public function handle(PresentationReminders $reminders): int
    {
        $sent = $reminders->send(Date::now());

        $this->info("{$sent} pengingat presentasi dikirim.");

        return self::SUCCESS;
    }
}
