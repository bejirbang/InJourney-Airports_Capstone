<?php

namespace App\Services;

use App\Models\SystemSetting;

/**
 * Angka kebijakan yang bisa diubah admin tanpa mengubah kode. Key yang belum ada di tabel memakai nilai awal.
 */
class SystemSettings
{
    public const LATE_TOLERANCE_MINUTES = 'late_tolerance_minutes';

    public const LEAVE_QUOTA = 'leave_quota';

    public const END_REMINDER_DAYS = 'end_reminder_days';

    public const LEAVE_ESCALATION_HOURS = 'leave_escalation_hours';

    public const DEFAULTS = [
        self::LATE_TOLERANCE_MINUTES => '15',
        self::LEAVE_QUOTA => '3',
        self::END_REMINDER_DAYS => '7',
        self::LEAVE_ESCALATION_HOURS => '24',
    ];

    /** @var array<string, string>|null */
    private ?array $values = null;

    public static function seedDefaults(): void
    {
        foreach (self::DEFAULTS as $key => $value) {
            SystemSetting::query()->firstOrCreate(['key' => $key], ['value' => $value]);
        }
    }

    public function get(string $key): string
    {
        $this->values ??= SystemSetting::query()->pluck('value', 'key')->all();

        return $this->values[$key] ?? self::DEFAULTS[$key];
    }

    public function set(string $key, string $value): void
    {
        SystemSetting::query()->updateOrCreate(['key' => $key], ['value' => $value]);

        $this->values = null;
    }

    public function lateToleranceMinutes(): int
    {
        return (int) $this->get(self::LATE_TOLERANCE_MINUTES);
    }

    public function leaveQuota(): int
    {
        return (int) $this->get(self::LEAVE_QUOTA);
    }

    public function endReminderDays(): int
    {
        return (int) $this->get(self::END_REMINDER_DAYS);
    }

    public function leaveEscalationHours(): int
    {
        return (int) $this->get(self::LEAVE_ESCALATION_HOURS);
    }
}
