<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\InternProfile;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

class EndingInternshipReminders
{
    public function __construct(private Notifier $notifier, private EndingInternships $endings) {}

    public function send(CarbonInterface $now): int
    {
        $profiles = $this->endings->ordered($now)
            ->get()
            ->reject(fn (InternProfile $profile): bool => $profile->ending_notified_for?->toDateString() === $profile->end_date->toDateString());

        if ($profiles->isEmpty()) {
            return 0;
        }

        $admins = User::query()->where('role', Role::Admin)->where('is_active', true)->pluck('id')->all();
        $sent = 0;

        foreach ($profiles as $profile) {
            $endDate = $profile->end_date->toDateString();

            // Update bersyarat agar dua proses scheduler tidak mengirim dua kali.
            $claimed = InternProfile::query()
                ->whereKey($profile->id)
                ->whereDate('end_date', $endDate)
                ->where(fn (Builder $q) => $q->whereNull('ending_notified_for')->orWhereDate('ending_notified_for', '!=', $endDate))
                ->update(['ending_notified_for' => $endDate]);

            if ($claimed === 0) {
                continue;
            }

            $this->notifier->send($admins, $this->text($profile, $now), '/');

            $sent++;
        }

        return $sent;
    }

    private function text(InternProfile $profile, CarbonInterface $now): string
    {
        $days = $profile->daysLeft($now);
        $when = $days === 0 ? 'hari ini' : "dalam {$days} hari";

        return "Magang {$profile->user->shortName()} berakhir {$when}.";
    }
}
