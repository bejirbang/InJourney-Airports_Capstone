<?php

use App\Models\Attendance;
use App\Models\DailyReport;
use App\Models\Office;
use App\Models\User;
use App\Models\WorkHourSetting;
use Illuminate\Support\Carbon;

// Senin, 12 Oktober 2026 pukul 17:03. Clock in pukul 08:02, jam kerja 08:00 sampai 17:00.
// Kantor di -6.1256, 106.6559: radius clock in 100 m, radius clock out 300 m.
beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 17:03:00'));

    $this->intern = User::factory()->intern([
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create();
    $this->token = $this->intern->createToken('api')->plainTextToken;
    $this->office = Office::factory()->create(['name' => 'Kantor Pusat Terminal 3']);
    WorkHourSetting::factory()->create(['effective_from' => '2026-01-01']);

    $this->attendance = Attendance::factory()->clockedIn()->for($this->intern, 'intern')->create([
        'date' => '2026-10-12',
        'clock_in_at' => '08:02:00',
        'clock_in_office_id' => $this->office->id,
    ]);
    DailyReport::factory()->for($this->attendance)->create();
});

/**
 * 0.002 derajat lintang sekitar 222 m: di luar radius clock in, di dalam radius clock out.
 */
function clockOut(array $extra = [], float $lat = -6.1256 + 0.002, float $lng = 106.6559)
{
    return test()->postJson('/api/intern/attendance/clock-out', ['latitude' => $lat, 'longitude' => $lng, ...$extra], [
        'Authorization' => 'Bearer '.test()->token,
    ]);
}

it('records clock out inside the clock out radius', function () {
    clockOut()
        ->assertOk()
        ->assertJsonPath('message', 'Clock out berhasil pukul 17:03. Terima kasih.')
        ->assertJsonPath('data.clock_in_at', '08:02')
        ->assertJsonPath('data.clock_out_at', '17:03')
        ->assertJsonPath('data.clock_in_office.id', $this->office->id)
        ->assertJsonPath('data.clock_out_office', ['id' => $this->office->id, 'name' => 'Kantor Pusat Terminal 3']);

    $attendance = $this->attendance->refresh();
    expect($attendance->clock_out_at)->toBe('17:03:00')
        ->and($attendance->clock_out_office_id)->toBe($this->office->id)
        ->and((float) $attendance->clock_out_latitude)->toEqualWithDelta(-6.1236, 0.0000001);
});

it('shows the day as clocked out and locks the daily report', function () {
    clockOut()->assertOk();

    $this->getJson('/api/intern/dashboard')
        ->assertJsonPath('data.today.state', 'clocked_out')
        ->assertJsonPath('data.today.clock_out_at', '17:03');

    $this->putJson('/api/intern/attendance/daily-report', ['work' => 'Diubah.'])
        ->assertJsonPath('reason', 'clocked_out');
});

it('requires the daily report before clock out', function () {
    $this->attendance->dailyReport()->delete();

    clockOut()
        ->assertUnprocessable()
        ->assertExactJson([
            'message' => 'Daily Report belum dikirim. Isi dulu sebelum clock out.',
            'reason' => 'daily_report_missing',
        ]);

    expect($this->attendance->refresh()->clock_out_at)->toBeNull();
});

it('rejects clock out before the end of work hours with the time left', function (string $now, string $left) {
    $this->travelTo(Carbon::parse("2026-10-12 {$now}"));

    clockOut()
        ->assertUnprocessable()
        ->assertExactJson([
            'message' => "Belum saatnya clock out, tunggu {$left} lagi.",
            'reason' => 'before_work_end',
        ]);

    expect($this->attendance->refresh()->clock_out_at)->toBeNull();
})->with([
    ['16:15:00', '45 menit'],
    ['16:00:00', '1 jam'],
    ['15:59:00', '1 jam 1 menit'],
    ['14:20:00', '2 jam 40 menit'],
    ['16:59:30', '1 menit'], // sisa detik dibulatkan ke atas
]);

it('does not accept the old early confirmation flag', function () {
    $this->travelTo(Carbon::parse('2026-10-12 15:30:00'));

    clockOut(['confirm_early' => true])->assertJsonPath('reason', 'before_work_end');
});

it('allows clock out exactly at the end of work hours', function () {
    $this->travelTo(Carbon::parse('2026-10-12 17:00:00'));

    clockOut()->assertOk()->assertJsonPath('data.clock_out_at', '17:00');
});

it('checks the daily report before asking about the work hours', function () {
    $this->travelTo(Carbon::parse('2026-10-12 15:30:00'));
    $this->attendance->dailyReport()->delete();

    clockOut()->assertJsonPath('reason', 'daily_report_missing');
});

it('uses the work hours effective on that day', function () {
    WorkHourSetting::factory()->create(['end_time' => '16:00:00', 'effective_from' => '2026-10-12']);
    WorkHourSetting::factory()->create(['end_time' => '15:00:00', 'effective_from' => '2026-10-13']);
    $this->travelTo(Carbon::parse('2026-10-12 16:00:00'));

    clockOut()->assertOk();
});

it('has no end-of-work limit when admin has not set work hours', function () {
    WorkHourSetting::query()->delete();
    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));

    clockOut()->assertOk();

    $this->getJson('/api/intern/dashboard')->assertJsonPath('data.today.work_hours', null);
});

it('shows the work hours on the today card', function () {
    $this->getJson('/api/intern/dashboard', ['Authorization' => 'Bearer '.$this->token])
        ->assertJsonPath('data.today.work_hours', ['start' => '08:00', 'end' => '17:00']);
});

it('rejects a position outside the clock out radius of every active office', function () {
    clockOut(lat: -6.1256 + 0.004) // sekitar 445 m
        ->assertUnprocessable()
        ->assertExactJson([
            'message' => 'Lokasi Anda belum sesuai. Clock out belum bisa dilakukan.',
            'reason' => 'outside_radius',
        ]);

    expect($this->attendance->refresh()->clock_out_at)->toBeNull();
});

it('allows clock out at a different active office than clock in', function () {
    $other = Office::factory()->create(['latitude' => -6.1400, 'clock_out_radius_meters' => 200]);

    clockOut(lat: -6.1400 + 0.001)
        ->assertOk()
        ->assertJsonPath('data.clock_in_office.id', $this->office->id)
        ->assertJsonPath('data.clock_out_office.id', $other->id);
});

it('rejects clock out when there is no active office', function () {
    $this->office->update(['is_active' => false]);

    clockOut()
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Belum ada kantor aktif. Clock out belum bisa dilakukan. Hubungi admin.')
        ->assertJsonPath('reason', 'no_active_office');
});

it('rejects clock out before clock in', function () {
    $this->attendance->delete();

    clockOut()
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Anda belum clock in hari ini.')
        ->assertJsonPath('reason', 'not_clocked_in');
});

it('allows only one clock out per day', function () {
    clockOut()->assertOk();

    $this->travelTo(Carbon::parse('2026-10-12 18:00:00'));

    clockOut()
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Anda sudah clock out hari ini.')
        ->assertJsonPath('reason', 'already_clocked_out');

    expect($this->attendance->refresh()->clock_out_at)->toBe('17:03:00');
});

it('does not allow a second clock in after clock out', function () {
    clockOut()->assertOk();

    $this->postJson('/api/intern/attendance/clock-in', ['latitude' => -6.1256, 'longitude' => 106.6559])
        ->assertJsonPath('reason', 'already_clocked_in');
});

it('cannot close yesterday after 23:59', function () {
    // Lupa clock out: esok harinya clock out tidak lagi menyentuh absensi kemarin.
    $this->travelTo(Carbon::parse('2026-10-13 07:00:00'));

    clockOut()->assertJsonPath('reason', 'not_clocked_in');

    expect($this->attendance->refresh()->clock_out_at)->toBeNull();
});

it('rejects a missing position', function () {
    $this->postJson('/api/intern/attendance/clock-out', [], ['Authorization' => 'Bearer '.$this->token])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Lokasi tidak dapat dibaca. Coba lagi.');
});

it('rejects mentors and admins', function (string $role) {
    $user = User::factory()->{$role}()->create();

    $this->postJson('/api/intern/attendance/clock-out', ['latitude' => -6.1256, 'longitude' => 106.6559], [
        'Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken,
    ])->assertForbidden();
})->with(['mentor', 'admin']);

it('rejects requests without a token', function () {
    $this->postJson('/api/intern/attendance/clock-out', ['latitude' => -6.1256, 'longitude' => 106.6559])
        ->assertUnauthorized();
});
