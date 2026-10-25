<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\LeaveRequest;
use App\Models\User;
use Carbon\CarbonInterface;

class OverdueLeaveReminders
{
    public function __construct(private Notifier $notifier, private SystemSettings $settings) {}

    public function send(CarbonInterface $now): int
    {
        $hours = $this->settings->leaveEscalationHours();
        $leaves = LeaveRequest::query()
            ->overduePending($now, $hours)
            ->whereNull('overdue_notified_at')
            ->whereHas('intern')
            ->with('intern:id,name')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        if ($leaves->isEmpty()) {
            return 0;
        }

        $admins = User::query()->where('role', Role::Admin)->where('is_active', true)->pluck('id')->all();
        $sent = 0;

        foreach ($leaves as $leave) {
            // Update bersyarat agar dua proses scheduler tidak mengirim dua kali.
            $claimed = LeaveRequest::query()->whereKey($leave->id)->whereNull('overdue_notified_at')->update(['overdue_notified_at' => $now]);

            if ($claimed === 0) {
                continue;
            }

            $this->notifier->send(
                $admins,
                "Izin {$leave->intern->shortName()} belum diproses mentor lebih dari {$hours} jam.",
                '/izin',
                ['open' => $leave->id],
            );

            $sent++;
        }

        return $sent;
    }
}
