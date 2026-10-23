<?php

namespace App\Services;

use App\Exceptions\ActionRejected;
use App\Models\AuditLog;
use App\Models\User;
use App\Models\WorkHourSetting;
use App\Support\IndonesianDate;
use Carbon\CarbonInterface;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AdminWorkHours
{
    public const CUTOFF = '23:59';

    public const CONFLICT = 'Jam kerja baru saja diubah admin lain. Muat ulang lalu coba lagi.';

    /**
     * @return array{current: array<string, string>|null, cutoff: string, history: list<array<string, string>>}
     */
    public function overview(CarbonInterface $now): array
    {
        $today = $now->toDateString();
        $current = WorkHourSetting::effectiveOn($today);

        $history = WorkHourSetting::query()->orderByDesc('effective_from')->get()
            ->map(fn (WorkHourSetting $setting): array => [
                ...$this->row($setting),
                'state' => match (true) {
                    $setting->effective_from->toDateString() > $today => 'upcoming',
                    $setting->is($current) => 'current',
                    default => 'past',
                },
            ]);

        return [
            'current' => $current === null ? null : $this->row($current),
            'cutoff' => self::CUTOFF,
            'history' => array_values($history->all()),
        ];
    }

    /**
     * @param  array{start_time: string, end_time: string, effective_from: string}  $data
     *
     * @throws ActionRejected
     */
    public function save(User $admin, array $data): WorkHourSetting
    {
        try {
            return DB::transaction(function () use ($admin, $data): WorkHourSetting {
                $setting = WorkHourSetting::query()->whereDate('effective_from', $data['effective_from'])->lockForUpdate()->first()
                    ?? new WorkHourSetting(['effective_from' => $data['effective_from']]);

                $setting->fill(['start_time' => $data['start_time'].':00', 'end_time' => $data['end_time'].':00'])->save();

                AuditLog::record(
                    $admin,
                    AuditLog::ACTION_CALENDAR,
                    'Jam kerja',
                    "Ubah jam kerja menjadi {$data['start_time']} - {$data['end_time']} mulai ".IndonesianDate::withYear(Carbon::parse($data['effective_from'])).'.',
                );

                return $setting;
            });
        } catch (UniqueConstraintViolationException) {
            // Dua admin membuat pengaturan untuk tanggal efektif yang sama bersamaan.
            throw new ActionRejected(self::CONFLICT, 'conflict');
        }
    }

    /**
     * @return array{effective_from: string, start: string, end: string}
     */
    public function row(WorkHourSetting $setting): array
    {
        return ['effective_from' => $setting->effective_from->toDateString(), ...$setting->toHours()];
    }
}
