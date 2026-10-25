<?php

use App\Models\AirportWeeklySchedule;
use App\Models\Attendance;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\Office;
use App\Models\User;
use App\Services\SystemSettings;
use Illuminate\Support\Carbon;

const OFFICE_LAT = -6.1256;
const OFFICE_LNG = 106.6559;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 08:02:15'));

    $this->intern = User::factory()->intern([
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create();
    $this->airport = $this->intern->internProfile->airport;
    $this->office = Office::factory()->for($this->airport)->create(['name' => 'Terminal 3']);
});

/**
 * 0.0005 derajat lintang sekitar 56 m; 0.002 derajat sekitar 222 m.
 */
function clockIn(User $user, float $lat = OFFICE_LAT + 0.0005, float $lng = OFFICE_LNG)
{
    return test()->postJson('/api/intern/attendance/clock-in', ['latitude' => $lat, 'longitude' => $lng], [
        'Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken,
    ]);
}

it('records clock in inside the clock in radius of an office of the intern airport', function () {
    clockIn($this->intern)
        ->assertCreated()
        ->assertJsonPath('message', 'Clock in berhasil pukul 08:02.')
        ->assertJsonPath('data.date', '2026-10-12')
        ->assertJsonPath('data.status', 'present')
        ->assertJsonPath('data.clock_in_at', '08:02')
        ->assertJsonPath('data.clock_out_at', null)
        ->assertJsonPath('data.late_minutes', null)
        ->assertJsonPath('data.scheduled', ['start' => '08:00', 'end' => '17:00'])
        ->assertJsonPath('data.clock_in_office', ['id' => $this->office->id, 'name' => 'Terminal 3'])
        ->assertJsonPath('data.is_corrected', false);

    $attendance = Attendance::sole();
    expect($attendance->intern_id)->toBe($this->intern->id)
        ->and($attendance->clock_in_at)->toBe('08:02:15')
        ->and($attendance->clock_in_office_id)->toBe($this->office->id)
        ->and((float) $attendance->clock_in_latitude)->toEqualWithDelta(-6.1251, 0.0000001)
        ->and($attendance->clock_out_at)->toBeNull();
});

it('changes the dashboard to clocked in with a logbook reminder', function () {
    clockIn($this->intern)->assertCreated();

    $this->getJson('/api/intern/dashboard')
        ->assertJsonPath('data.today.state', 'clocked_in')
        ->assertJsonPath('data.today.status', 'present')
        ->assertJsonPath('data.today.clock_in_at', '08:02')
        ->assertJsonPath('data.today.clock_out_from', '17:00')
        ->assertJsonPath('data.today.can_clock_out', false)
        ->assertJsonPath('data.logbook_reminder', true);
});

it('accepts any active office of the airport and records the nearest one in range', function () {
    $far = Office::factory()->for($this->airport)->create(['latitude' => OFFICE_LAT + 0.0015, 'clock_in_radius_meters' => 500]);
    $near = Office::factory()->for($this->airport)->create(['latitude' => OFFICE_LAT + 0.0030, 'clock_in_radius_meters' => 200]);

    // Di luar radius titik pertama, tetapi di dalam radius dua titik lain.
    clockIn($this->intern, OFFICE_LAT + 0.0025)
        ->assertCreated()
        ->assertJsonPath('data.clock_in_office.id', $near->id);

    expect($far->id)->not->toBe($near->id);
});

it('ignores offices of other airports', function () {
    Office::factory()->create(['latitude' => OFFICE_LAT + 0.002, 'clock_in_radius_meters' => 500]);

    clockIn($this->intern, OFFICE_LAT + 0.002)->assertJsonPath('reason', 'outside_radius');

    $this->office->update(['is_active' => false]);

    clockIn($this->intern, OFFICE_LAT + 0.002)->assertJsonPath('reason', 'no_active_office');
});

it('rejects a position outside the clock in radius of every active office', function () {
    clockIn($this->intern, OFFICE_LAT + 0.002)
        ->assertUnprocessable()
        ->assertExactJson([
            'message' => 'Lokasi Anda belum sesuai. Clock in belum bisa dilakukan.',
            'reason' => 'outside_radius',
        ]);

    expect(Attendance::count())->toBe(0);
});

it('uses the clock in radius, not the larger clock out radius', function () {
    // 222 m: masuk radius clock out (300 m) tetapi tidak masuk radius clock in (100 m).
    clockIn($this->intern, OFFICE_LAT + 0.002)->assertJsonPath('reason', 'outside_radius');
});

it('ignores inactive offices', function () {
    Office::factory()->for($this->airport)->inactive()->create(['latitude' => OFFICE_LAT + 0.002]);

    clockIn($this->intern, OFFICE_LAT + 0.002)->assertJsonPath('reason', 'outside_radius');
});

it('rejects clock in when the airport has no active office', function () {
    $this->office->update(['is_active' => false]);

    clockIn($this->intern)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Belum ada kantor aktif. Clock in belum bisa dilakukan. Hubungi admin.')
        ->assertJsonPath('reason', 'no_active_office');

    $this->getJson('/api/intern/dashboard')->assertJsonPath('data.today.has_active_office', false);
});

it('allows only one clock in per day', function () {
    clockIn($this->intern)->assertCreated();

    clockIn($this->intern)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Anda sudah clock in hari ini.')
        ->assertJsonPath('reason', 'already_clocked_in');

    expect(Attendance::count())->toBe(1);
});

it('rejects clock in on a holiday', function () {
    Holiday::factory()->create(['date' => '2026-10-12', 'name' => 'Libur Nasional']);

    clockIn($this->intern)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Hari ini libur.')
        ->assertJsonPath('reason', 'holiday');
});

it('rejects clock in on a non-working day of the airport schedule', function () {
    $this->travelTo(Carbon::parse('2026-10-17 08:00:00'));

    clockIn($this->intern)->assertJsonPath('reason', 'holiday');

    AirportWeeklySchedule::factory()->for($this->airport)->off()->create(['day_of_week' => 1, 'effective_from' => '2026-10-12']);
    $this->travelTo(Carbon::parse('2026-10-19 08:00:00'));

    clockIn($this->intern)->assertJsonPath('reason', 'holiday');
});

it('rejects clock in on a day with approved leave', function () {
    LeaveRequest::factory()->for($this->intern, 'intern')->approved()->create([
        'start_date' => '2026-10-12',
        'end_date' => '2026-10-12',
    ]);

    clockIn($this->intern)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Anda sedang izin hari ini.')
        ->assertJsonPath('reason', 'on_leave');
});

it('still allows clock in while leave for today is pending', function () {
    LeaveRequest::factory()->for($this->intern, 'intern')->create([
        'start_date' => '2026-10-12',
        'end_date' => '2026-10-12',
    ]);

    clockIn($this->intern)->assertCreated();
});

it('allows clock in only before the end of work hours', function () {
    $this->travelTo(Carbon::parse('2026-10-12 16:59:59'));
    clockIn($this->intern)->assertCreated();

    Attendance::query()->delete();
    $this->travelTo(Carbon::parse('2026-10-12 17:00:00'));

    clockIn($this->intern)
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Jam pulang sudah lewat. Clock in tidak bisa dilakukan, gunakan Clock Out.')
        ->assertJsonPath('reason', 'after_work_end');

    $this->getJson('/api/intern/dashboard')
        ->assertJsonPath('data.today.state', 'missed_clock_in')
        ->assertJsonPath('data.today.can_clock_out', true);
});

it('marks clock in after the start time plus tolerance as late, counting from the start time', function (string $time, string $message, string $status, ?int $late) {
    $this->travelTo(Carbon::parse("2026-10-12 {$time}"));

    clockIn($this->intern)
        ->assertCreated()
        ->assertJsonPath('message', $message)
        ->assertJsonPath('data.status', $status)
        ->assertJsonPath('data.late_minutes', $late);

    $this->getJson('/api/intern/dashboard')
        ->assertJsonPath('data.today.status', $status)
        ->assertJsonPath('data.today.late_minutes', $late);
})->with([
    'sebelum jam masuk' => ['07:45:00', 'Clock in berhasil pukul 07:45.', 'present', null],
    'akhir toleransi 08:15' => ['08:15:59', 'Clock in berhasil pukul 08:15.', 'present', null],
    'lewat toleransi 08:16' => ['08:16:00', 'Clock in berhasil pukul 08:16. Anda tercatat Terlambat 16 menit.', 'late', 16],
    'lewat 1 jam 1 menit' => ['09:01:00', 'Clock in berhasil pukul 09:01. Anda tercatat Terlambat 1 jam 1 menit.', 'late', 61],
]);

it('uses the late tolerance from the settings and keeps the copy for that day', function () {
    app(SystemSettings::class)->set(SystemSettings::LATE_TOLERANCE_MINUTES, '0');
    $this->travelTo(Carbon::parse('2026-10-12 08:01:00'));

    clockIn($this->intern)->assertJsonPath('data.status', 'late')->assertJsonPath('data.late_minutes', 1);

    app(SystemSettings::class)->set(SystemSettings::LATE_TOLERANCE_MINUTES, '15');

    $this->getJson('/api/intern/dashboard')->assertJsonPath('data.today.status', 'late');
});

it('uses the airport schedule effective on that day', function () {
    AirportWeeklySchedule::factory()->for($this->airport)->create([
        'day_of_week' => 1,
        'start_time' => '09:00:00',
        'end_time' => '17:00:00',
        'effective_from' => '2026-10-12',
    ]);
    $this->travelTo(Carbon::parse('2026-10-12 09:10:00'));

    clockIn($this->intern)->assertJsonPath('data.status', 'present')->assertJsonPath('data.scheduled.start', '09:00');
});

it('copies the schedule and the late tolerance into the attendance row', function () {
    app(SystemSettings::class)->set(SystemSettings::LATE_TOLERANCE_MINUTES, '10');

    clockIn($this->intern)->assertCreated();

    expect(Attendance::sole()->only(['scheduled_start', 'scheduled_end', 'late_tolerance_minutes']))->toBe([
        'scheduled_start' => '08:00:00',
        'scheduled_end' => '17:00:00',
        'late_tolerance_minutes' => 10,
    ]);
});

it('rejects a missing or invalid position', function (array $payload) {
    $this->postJson('/api/intern/attendance/clock-in', $payload, [
        'Authorization' => 'Bearer '.$this->intern->createToken('api')->plainTextToken,
    ])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Lokasi tidak dapat dibaca. Coba lagi.');
})->with([
    'tanpa posisi' => [[]],
    'bukan angka' => [['latitude' => 'abc', 'longitude' => OFFICE_LNG]],
    'lintang di luar batas' => [['latitude' => 91, 'longitude' => OFFICE_LNG]],
]);

it('rejects mentors and admins', function (string $role) {
    clockIn(User::factory()->{$role}()->create())->assertForbidden();
})->with(['mentor', 'admin']);

it('rejects an intern who has not changed the temporary password', function () {
    $this->intern->update(['must_change_password' => true]);

    clockIn($this->intern)->assertForbidden()->assertJsonPath('must_change_password', true);
});

it('rejects requests without a token', function () {
    $this->postJson('/api/intern/attendance/clock-in', ['latitude' => OFFICE_LAT, 'longitude' => OFFICE_LNG])
        ->assertUnauthorized();
});
