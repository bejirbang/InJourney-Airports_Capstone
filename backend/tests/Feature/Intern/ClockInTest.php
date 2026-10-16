<?php

use App\Models\Attendance;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\Office;
use App\Models\User;
use App\Models\WorkHourSetting;
use Illuminate\Support\Carbon;

// Senin, 12 Oktober 2026 pukul 08:02:15. Kantor di Terminal 3 dengan radius clock in 100 m.
const OFFICE_LAT = -6.1256;
const OFFICE_LNG = 106.6559;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 08:02:15'));

    $this->intern = User::factory()->intern([
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create();
    $this->office = Office::factory()->create(['name' => 'Kantor Pusat Terminal 3']);
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

it('records clock in inside the clock in radius of an active office', function () {
    clockIn($this->intern)
        ->assertCreated()
        ->assertJsonPath('message', 'Clock in berhasil pukul 08:02.')
        ->assertJsonPath('data.date', '2026-10-12')
        ->assertJsonPath('data.clock_in_at', '08:02')
        ->assertJsonPath('data.clock_out_at', null)
        ->assertJsonPath('data.clock_in_office', ['id' => $this->office->id, 'name' => 'Kantor Pusat Terminal 3'])
        ->assertJsonPath('data.is_corrected', false);

    $attendance = Attendance::sole();
    expect($attendance->intern_id)->toBe($this->intern->id)
        ->and($attendance->clock_in_at)->toBe('08:02:15')
        ->and($attendance->clock_in_office_id)->toBe($this->office->id)
        ->and((float) $attendance->clock_in_latitude)->toEqualWithDelta(-6.1251, 0.0000001)
        ->and($attendance->clock_out_at)->toBeNull();
});

it('changes the dashboard to clocked in with a daily report reminder', function () {
    clockIn($this->intern)->assertCreated();

    $this->getJson('/api/intern/dashboard')
        ->assertJsonPath('data.today.state', 'clocked_in')
        ->assertJsonPath('data.today.clock_in_at', '08:02')
        ->assertJsonPath('data.daily_report_reminder', true);
});

it('accepts any active office and records the nearest one in range', function () {
    $far = Office::factory()->create(['latitude' => OFFICE_LAT + 0.0015, 'clock_in_radius_meters' => 500]);
    $near = Office::factory()->create(['latitude' => OFFICE_LAT + 0.0030, 'clock_in_radius_meters' => 200]);

    // Di luar radius kantor pertama, tetapi di dalam radius dua kantor lain.
    clockIn($this->intern, OFFICE_LAT + 0.0025)
        ->assertCreated()
        ->assertJsonPath('data.clock_in_office.id', $near->id);

    expect($far->id)->not->toBe($near->id);
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
    Office::factory()->inactive()->create(['latitude' => OFFICE_LAT + 0.002]);

    clockIn($this->intern, OFFICE_LAT + 0.002)->assertJsonPath('reason', 'outside_radius');
});

it('rejects clock in when there is no active office', function () {
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

it('rejects clock in on a weekend', function () {
    $this->travelTo(Carbon::parse('2026-10-17 08:00:00'));

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

it('does not limit the clock in time', function () {
    $this->travelTo(Carbon::parse('2026-10-12 21:45:00'));

    clockIn($this->intern)
        ->assertCreated()
        ->assertJsonPath('message', 'Clock in berhasil pukul 21:45.')
        ->assertJsonPath('data.late_minutes', null); // jam kerja belum diatur
});

it('marks clock in after the start of work hours as late', function (string $time, string $message, int $late) {
    WorkHourSetting::factory()->create(['start_time' => '08:00:00', 'effective_from' => '2026-01-01']);
    $this->travelTo(Carbon::parse("2026-10-12 {$time}"));

    clockIn($this->intern)
        ->assertCreated()
        ->assertJsonPath('message', $message)
        ->assertJsonPath('data.late_minutes', $late);

    $this->getJson('/api/intern/dashboard')->assertJsonPath('data.today.late_minutes', $late);
})->with([
    'sebelum jam masuk' => ['07:45:00', 'Clock in berhasil pukul 07:45.', 0],
    'tepat 08:00' => ['08:00:45', 'Clock in berhasil pukul 08:00.', 0],
    'lewat 2 menit' => ['08:02:15', 'Clock in berhasil pukul 08:02. Anda terlambat 2 menit.', 2],
    'lewat 1 jam 1 menit' => ['09:01:00', 'Clock in berhasil pukul 09:01. Anda terlambat 1 jam 1 menit.', 61],
]);

it('uses the start time effective on that day for lateness', function () {
    WorkHourSetting::factory()->create(['start_time' => '08:00:00', 'effective_from' => '2026-01-01']);
    WorkHourSetting::factory()->create(['start_time' => '09:00:00', 'effective_from' => '2026-10-12']);
    $this->travelTo(Carbon::parse('2026-10-12 08:30:00'));

    clockIn($this->intern)->assertJsonPath('data.late_minutes', 0);
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
