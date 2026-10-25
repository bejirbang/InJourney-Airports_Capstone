<?php

use App\Models\Airport;
use App\Models\AirportSpecialSchedule;
use App\Models\AirportWeeklySchedule;
use App\Models\Holiday;
use App\Models\User;
use App\Services\WorkSchedules;

beforeEach(function () {
    // Jadwal bawaan factory: Senin-Jumat 08:00-17:00, Sabtu dan Minggu libur.
    $this->airport = Airport::factory()->create();
    $this->schedules = app(WorkSchedules::class);
});

it('uses the weekly schedule on a normal workday', function () {
    $day = $this->schedules->forDate($this->airport->id, '2026-10-12');

    expect($day->isWorkday)->toBeTrue()
        ->and($day->hours())->toBe(['start' => '08:00', 'end' => '17:00'])
        ->and($day->holidayName)->toBeNull();
});

it('treats a non-working day of the weekly schedule as a day off', function () {
    $day = $this->schedules->forDate($this->airport->id, '2026-10-17');

    expect($day->isWorkday)->toBeFalse()->and($day->hours())->toBeNull();
});

it('lets a holiday win over every schedule, for every airport', function () {
    Holiday::factory()->create(['date' => '2026-10-12', 'name' => 'Libur Daerah']);
    AirportSpecialSchedule::factory()->for($this->airport)->create(['start_date' => '2026-10-01', 'end_date' => '2026-10-31']);
    $other = Airport::factory()->create();

    foreach ([$this->airport, $other] as $airport) {
        $day = $this->schedules->forDate($airport->id, '2026-10-12');

        expect($day->isWorkday)->toBeFalse()->and($day->holidayName)->toBe('Libur Daerah');
    }
});

it('uses the special schedule hours on workdays inside its range only', function () {
    AirportSpecialSchedule::factory()->for($this->airport)->create([
        'name' => 'Jam kerja Ramadan',
        'start_date' => '2026-10-12',
        'end_date' => '2026-10-18',
        'start_time' => '08:00:00',
        'end_time' => '15:00:00',
    ]);

    $days = $this->schedules->between($this->airport->id, '2026-10-11', '2026-10-19');

    expect($days['2026-10-12']->hours())->toBe(['start' => '08:00', 'end' => '15:00'])
        ->and($days['2026-10-12']->specialName)->toBe('Jam kerja Ramadan')
        ->and($days['2026-10-17']->isWorkday)->toBeFalse()
        ->and($days['2026-10-19']->hours())->toBe(['start' => '08:00', 'end' => '17:00'])
        ->and($days['2026-10-11']->isWorkday)->toBeFalse();
});

it('applies a new weekly schedule from its effective date and keeps past days on the old one', function () {
    AirportWeeklySchedule::factory()->for($this->airport)->create([
        'day_of_week' => 1, 'start_time' => '07:00:00', 'end_time' => '16:00:00', 'effective_from' => '2026-10-19',
    ]);
    AirportWeeklySchedule::factory()->for($this->airport)->off()->create(['day_of_week' => 2, 'effective_from' => '2026-10-19']);

    $days = $this->schedules->between($this->airport->id, '2026-10-12', '2026-10-20');

    expect($days['2026-10-12']->hours())->toBe(['start' => '08:00', 'end' => '17:00'])
        ->and($days['2026-10-13']->isWorkday)->toBeTrue()
        ->and($days['2026-10-19']->hours())->toBe(['start' => '07:00', 'end' => '16:00'])
        ->and($days['2026-10-20']->isWorkday)->toBeFalse();
});

it('keeps each airport on its own schedule', function () {
    $halim = Airport::factory()->create();
    AirportWeeklySchedule::factory()->for($halim)->create([
        'day_of_week' => 6, 'start_time' => '09:00:00', 'end_time' => '13:00:00', 'effective_from' => '2026-01-01',
    ]);

    expect($this->schedules->forDate($halim->id, '2026-10-17')->hours())->toBe(['start' => '09:00', 'end' => '13:00'])
        ->and($this->schedules->forDate($this->airport->id, '2026-10-17')->isWorkday)->toBeFalse();
});

it('treats dates before the first weekly schedule as days off', function () {
    expect($this->schedules->forDate($this->airport->id, '2019-12-31')->isWorkday)->toBeFalse();
});

it('reads the schedule of the intern airport and counts working days', function () {
    $intern = User::factory()->intern(['airport_id' => $this->airport->id])->create();
    Holiday::factory()->create(['date' => '2026-10-14']);

    expect($this->schedules->forIntern($intern, '2026-10-12')->isWorkday)->toBeTrue()
        ->and($this->schedules->workingDays($intern, '2026-10-12', '2026-10-18'))->toBe(4)
        ->and($this->schedules->workingDays($intern, '2026-10-18', '2026-10-12'))->toBe(0);
});

it('gives no working day to an account without an intern profile', function () {
    $mentor = User::factory()->mentor()->create();

    expect($this->schedules->workingDays($mentor, '2026-10-12', '2026-10-16'))->toBe(0);
});
