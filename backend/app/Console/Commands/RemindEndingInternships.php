<?php

namespace App\Console\Commands;

use App\Services\EndingInternshipReminders;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Date;

class RemindEndingInternships extends Command
{
    protected $signature = 'app:remind-ending-internships';

    protected $description = 'Ingatkan admin tentang magang yang berakhir dalam 7 hari';

    public function handle(EndingInternshipReminders $reminders): int
    {
        $sent = $reminders->send(Date::now());

        $this->info("{$sent} pengingat akhir magang dikirim.");

        return self::SUCCESS;
    }
}
