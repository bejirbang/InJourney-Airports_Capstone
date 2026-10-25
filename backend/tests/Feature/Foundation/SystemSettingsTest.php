<?php

use App\Models\SystemSetting;
use App\Services\SystemSettings;

it('falls back to the document defaults when a key is not stored', function () {
    $settings = app(SystemSettings::class);

    expect($settings->lateToleranceMinutes())->toBe(15)
        ->and($settings->leaveQuota())->toBe(3)
        ->and($settings->endReminderDays())->toBe(7)
        ->and($settings->leaveEscalationHours())->toBe(24);
});

it('reads stored values and sees its own changes', function () {
    SystemSetting::query()->create(['key' => SystemSettings::LEAVE_QUOTA, 'value' => '4']);
    $settings = app(SystemSettings::class);

    expect($settings->leaveQuota())->toBe(4);

    $settings->set(SystemSettings::LEAVE_QUOTA, '2');

    expect($settings->leaveQuota())->toBe(2)
        ->and(SystemSetting::query()->where('key', SystemSettings::LEAVE_QUOTA)->value('value'))->toBe('2');
});

it('seeds the defaults once without overwriting changed values', function () {
    SystemSetting::query()->create(['key' => SystemSettings::LATE_TOLERANCE_MINUTES, 'value' => '10']);

    SystemSettings::seedDefaults();
    SystemSettings::seedDefaults();

    expect(SystemSetting::query()->pluck('value', 'key')->all())->toEqualCanonicalizing([
        'late_tolerance_minutes' => '10',
        'leave_quota' => '3',
        'end_reminder_days' => '7',
        'leave_escalation_hours' => '24',
    ]);
});
