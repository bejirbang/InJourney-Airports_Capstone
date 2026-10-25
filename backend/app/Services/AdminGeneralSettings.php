<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Tab Pengaturan Umum. Perubahan berlaku untuk perhitungan berikutnya: toleransi terlambat sudah disalin ke baris
 * presensi yang ada, jadi status lama tidak berubah; kuota, pengingat, dan batas izin langsung dipakai.
 */
class AdminGeneralSettings
{
    /** @var array<string, array{0: string, 1: string}> label dan satuan untuk Log Aktivitas */
    private const LABELS = [
        SystemSettings::LATE_TOLERANCE_MINUTES => ['toleransi terlambat', 'menit'],
        SystemSettings::LEAVE_QUOTA => ['kuota izin per magang', 'kali'],
        SystemSettings::END_REMINDER_DAYS => ['pengingat akhir magang', 'hari'],
        SystemSettings::LEAVE_ESCALATION_HOURS => ['batas izin ke admin', 'jam'],
    ];

    public function __construct(private SystemSettings $settings) {}

    /**
     * @return array<string, int>
     */
    public function values(): array
    {
        return [
            SystemSettings::LATE_TOLERANCE_MINUTES => $this->settings->lateToleranceMinutes(),
            SystemSettings::LEAVE_QUOTA => $this->settings->leaveQuota(),
            SystemSettings::END_REMINDER_DAYS => $this->settings->endReminderDays(),
            SystemSettings::LEAVE_ESCALATION_HOURS => $this->settings->leaveEscalationHours(),
        ];
    }

    /**
     * @param  array<string, int>  $input
     * @return array<string, int>
     */
    public function update(User $admin, array $input): array
    {
        $current = $this->values();
        $changes = array_filter($input, fn (int $value, string $key): bool => $current[$key] !== $value, ARRAY_FILTER_USE_BOTH);

        if ($changes === []) {
            return $current;
        }

        DB::transaction(function () use ($admin, $changes, $current): void {
            $details = [];

            foreach ($changes as $key => $value) {
                $this->settings->set($key, (string) $value);
                [$label, $unit] = self::LABELS[$key];
                $details[] = 'Ubah '.$label.' dari '.$current[$key].' menjadi '.$value.' '.$unit.'.';
            }

            AuditLog::record($admin, AuditLog::ACTION_SETTINGS, 'Pengaturan Umum', implode(' ', $details));
        });

        return $this->values();
    }
}
