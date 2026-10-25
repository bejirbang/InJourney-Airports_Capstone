<?php

namespace App\Services;

use App\Models\InternProfile;
use Carbon\CarbonInterface;

/**
 * Pengingat presentasi ke intern sejak H-`end_reminder_days`, sekali per masa magang (`presentation_reminded_at`
 * dikosongkan saat diperpanjang). Intern yang sudah mengirim bukti tidak diingatkan.
 */
class PresentationReminders
{
    public function __construct(private Notifier $notifier, private EndingInternships $endings) {}

    public function send(CarbonInterface $now): int
    {
        $profiles = $this->endings->ordered($now)
            ->whereNull('presentation_reminded_at')
            ->whereDoesntHave('user.finalPresentation')
            ->get();

        $sent = 0;

        foreach ($profiles as $profile) {
            // Update bersyarat agar dua proses scheduler tidak mengirim dua kali.
            $claimed = InternProfile::query()
                ->whereKey($profile->id)
                ->whereNull('presentation_reminded_at')
                ->update(['presentation_reminded_at' => $now]);

            if ($claimed === 0) {
                continue;
            }

            $this->notifier->send([$profile->user_id], $this->text($profile, $now), '/presentasi');

            $sent++;
        }

        return $sent;
    }

    private function text(InternProfile $profile, CarbonInterface $now): string
    {
        $days = $profile->daysLeft($now);
        $when = $days === 0 ? 'hari ini' : "{$days} hari lagi";

        return "Magang Anda berakhir {$when}. Lakukan presentasi dan kirim buktinya.";
    }
}
