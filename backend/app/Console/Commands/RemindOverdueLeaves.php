<?php

namespace App\Console\Commands;

use App\Services\OverdueLeaveReminders;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Date;

class RemindOverdueLeaves extends Command
{
    protected $signature = 'app:remind-overdue-leaves';

    protected $description = 'Ingatkan admin tentang izin yang belum diproses mentor lebih dari 24 jam';

    public function handle(OverdueLeaveReminders $reminders): int
    {
        $sent = $reminders->send(Date::now());

        $this->info("{$sent} pengingat izin pending dikirim.");

        return self::SUCCESS;
    }
}
