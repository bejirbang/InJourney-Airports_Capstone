<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\InternProfile;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * Pengingat admin untuk magang yang berakhir dalam 7 hari (docs/design-admin.md 14, Alur 6).
 * Sekali per tanggal selesai, ke semua admin aktif. Setelah diperpanjang, tanggal selesai baru
 * diingatkan lagi saat masuk rentang 7 hari.
 */
class EndingInternshipReminders
{
    public function __construct(private Notifier $notifier, private EndingInternships $endings) {}

    /**
     * Kirim pengingat yang jatuh tempo. Mengembalikan jumlah intern yang diingatkan.
     */
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

    /**
     * "Magang Rina W. berakhir dalam 7 hari." Intern yang baru masuk rentang dengan sisa kurang dari 7 hari
     * (misalnya dibuat dengan periode pendek) mendapat jumlah hari sebenarnya.
     */
    private function text(InternProfile $profile, CarbonInterface $now): string
    {
        $days = $profile->daysLeft($now);
        $when = $days === 0 ? 'hari ini' : "dalam {$days} hari";

        return "Magang {$profile->user->shortName()} berakhir {$when}.";
    }
}
