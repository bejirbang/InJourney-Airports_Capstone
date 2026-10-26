<?php

use App\Enums\Role;
use App\Models\Airport;
use App\Models\AssessmentIndicator;
use App\Models\Office;
use App\Models\SystemSetting;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\ProductionSeeder;

it('seeds development data: units, airports with offices and schedules, accounts, indicators, settings', function () {
    $this->seed(DatabaseSeeder::class);

    $soetta = Airport::query()->where('name', 'Soekarno-Hatta')->sole();

    expect(Unit::query()->pluck('name')->all())->toBe(DatabaseSeeder::UNITS)
        ->and(Office::query()->where('airport_id', $soetta->id)->orderBy('name')->pluck('name')->all())->toBe(['Terminal 1', 'Terminal 2', 'Terminal 3'])
        ->and($soetta->weeklySchedules()->count())->toBe(7)
        ->and(Airport::query()->where('name', 'Halim Perdanakusuma')->sole()->offices()->count())->toBe(1)
        ->and(AssessmentIndicator::query()->count())->toBe(count(DatabaseSeeder::INDICATORS))
        ->and(SystemSetting::query()->count())->toBe(5)
        ->and(SystemSetting::query()->where('key', 'report_region_name')->value('value'))->toBe('Kantor Regional I')
        ->and(AssessmentIndicator::query()->orderBy('sort_order')->pluck('category')->unique()->values()->all())->toBe(['Motivasi', 'Kemampuan Kerja', 'Kepribadian'])
        ->and(AssessmentIndicator::query()->whereNotNull('weight')->exists())->toBeFalse()
        ->and($soetta->city)->toBe('Tangerang');

    $intern = User::query()->where('email', 'intern@injourney.test')->sole();

    expect($intern->role)->toBe(Role::Intern)
        ->and($intern->unit?->name)->toBe('Divisi IT')
        ->and($intern->internProfile?->airport_id)->toBe($soetta->id)
        ->and(User::query()->where('email', 'admin@injourney.test')->sole()->unit_id)->toBeNull();
});

it('seeds only the settings in production data and can run twice', function () {
    $this->seed(ProductionSeeder::class);
    $this->seed(ProductionSeeder::class);

    expect(SystemSetting::query()->count())->toBe(5)
        ->and(User::query()->count())->toBe(0)
        ->and(Airport::query()->count())->toBe(0);
});
