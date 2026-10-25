<?php

use App\Enums\LogbookStatus;
use App\Models\AirportWeeklySchedule;
use App\Models\Attendance;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\Logbook;
use App\Models\Notification;
use App\Models\Office;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 17:03:00'));

    $this->intern = User::factory()->intern([
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create();
    $this->token = $this->intern->createToken('api')->plainTextToken;
    $this->airport = $this->intern->internProfile->airport;
    $this->office = Office::factory()->for($this->airport)->create(['name' => 'Terminal 3']);

    $this->attendance = Attendance::factory()->clockedIn()->for($this->intern, 'intern')->create([
        'date' => '2026-10-12',
        'clock_in_at' => '08:02:00',
        'clock_in_office_id' => $this->office->id,
    ]);
    $this->logbook = Logbook::factory()->for($this->attendance)->create(['work' => 'Menyusun ERD.']);
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

it('records clock out inside the clock out radius and sends the logbook to the mentor', function () {
    clockOut()
        ->assertOk()
        ->assertJsonPath('message', 'Clock out berhasil pukul 17:03. Logbook terkirim ke mentor.')
        ->assertJsonPath('data.clock_in_at', '08:02')
        ->assertJsonPath('data.clock_out_at', '17:03')
        ->assertJsonPath('data.clock_in_office.id', $this->office->id)
        ->assertJsonPath('data.clock_out_office', ['id' => $this->office->id, 'name' => 'Terminal 3'])
        ->assertJsonPath('data.logbook_status', 'pending_review');

    $attendance = $this->attendance->refresh();
    expect($attendance->clock_out_at)->toBe('17:03:00')
        ->and($attendance->clock_out_office_id)->toBe($this->office->id)
        ->and((float) $attendance->clock_out_latitude)->toEqualWithDelta(-6.1236, 0.0000001)
        ->and($this->logbook->refresh()->status)->toBe(LogbookStatus::PendingReview)
        ->and($this->logbook->submitted_at?->toDateTimeString())->toBe('2026-10-12 17:03:00')
        // Logbook baru dari clock out tidak dikirim sebagai notifikasi ke mentor.
        ->and(Notification::count())->toBe(0);
});

it('shows the day as clocked out and locks the logbook', function () {
    clockOut()->assertOk();

    $this->getJson('/api/intern/dashboard')
        ->assertJsonPath('data.today.state', 'clocked_out')
        ->assertJsonPath('data.today.clock_out_at', '17:03')
        ->assertJsonPath('data.today.logbook.status', 'pending_review')
        ->assertJsonPath('data.today.can_clock_out', false);

    $this->putJson('/api/intern/logbooks/2026-10-12', ['work' => 'Diubah.'])
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'pending_review');
});

it('requires the logbook before clock out', function () {
    $this->logbook->delete();

    clockOut()
        ->assertUnprocessable()
        ->assertExactJson(['message' => 'Isi logbook dulu sebelum clock out.', 'reason' => 'logbook_missing']);

    expect($this->attendance->refresh()->clock_out_at)->toBeNull();
});

it('saves the logbook sent with the clock out request', function () {
    $this->logbook->delete();

    clockOut(['work' => 'Rapat kebutuhan.', 'notes' => 'Lanjut besok.'])->assertOk();

    expect(Logbook::sole()->only(['work', 'notes']))->toBe(['work' => 'Rapat kebutuhan.', 'notes' => 'Lanjut besok.'])
        ->and(Logbook::sole()->status)->toBe(LogbookStatus::PendingReview);
});

it('replaces the draft with the logbook sent with the clock out request', function () {
    clockOut(['work' => 'Isi akhir.'])->assertOk();

    expect($this->logbook->refresh()->work)->toBe('Isi akhir.');
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

it('allows clock out exactly at the end of work hours', function () {
    $this->travelTo(Carbon::parse('2026-10-12 17:00:00'));

    clockOut()->assertOk()->assertJsonPath('data.clock_out_at', '17:00');
});

it('checks the end of work hours before the logbook', function () {
    $this->travelTo(Carbon::parse('2026-10-12 15:30:00'));
    $this->logbook->delete();

    clockOut()->assertJsonPath('reason', 'before_work_end');
});

it('uses the end time copied when the intern clocked in', function () {
    $this->attendance->update(['scheduled_end' => '16:00:00']);
    $this->travelTo(Carbon::parse('2026-10-12 16:00:00'));

    clockOut()->assertOk();
});

it('ignores a schedule change made after clock in', function () {
    AirportWeeklySchedule::factory()->for($this->airport)->create([
        'day_of_week' => 1,
        'start_time' => '08:00:00',
        'end_time' => '15:00:00',
        'effective_from' => '2026-10-12',
    ]);
    $this->travelTo(Carbon::parse('2026-10-12 16:00:00'));

    clockOut()->assertUnprocessable()->assertJsonPath('reason', 'before_work_end');
});

it('shows the schedule and the clock out time on the today card', function () {
    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));

    $this->getJson('/api/intern/dashboard', ['Authorization' => 'Bearer '.$this->token])
        ->assertJsonPath('data.today.schedule', ['start' => '08:00', 'end' => '17:00'])
        ->assertJsonPath('data.today.clock_out_from', '17:00')
        ->assertJsonPath('data.today.can_clock_out', false)
        ->assertJsonPath('data.today.logbook', ['status' => 'draft', 'work' => 'Menyusun ERD.', 'notes' => null]);
});

it('rejects a position outside the clock out radius of every active office', function () {
    clockOut(lat: -6.1256 + 0.004) // sekitar 445 m
        ->assertUnprocessable()
        ->assertExactJson([
            'message' => 'Lokasi Anda belum sesuai. Clock out belum bisa dilakukan.',
            'reason' => 'outside_radius',
        ]);

    expect($this->attendance->refresh()->clock_out_at)->toBeNull()
        ->and($this->logbook->refresh()->status)->toBe(LogbookStatus::Draft);
});

it('allows clock out at a different active office of the same airport', function () {
    $other = Office::factory()->for($this->airport)->create(['latitude' => -6.1400, 'clock_out_radius_meters' => 200]);

    clockOut(lat: -6.1400 + 0.001)
        ->assertOk()
        ->assertJsonPath('data.clock_in_office.id', $this->office->id)
        ->assertJsonPath('data.clock_out_office.id', $other->id);
});

it('rejects offices of other airports', function () {
    Office::factory()->create(['latitude' => -6.1400, 'clock_out_radius_meters' => 200]);

    clockOut(lat: -6.1400 + 0.001)->assertJsonPath('reason', 'outside_radius');
});

it('rejects clock out when the airport has no active office', function () {
    $this->office->update(['is_active' => false]);

    clockOut()
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Belum ada kantor aktif. Clock out belum bisa dilakukan. Hubungi admin.')
        ->assertJsonPath('reason', 'no_active_office');
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

it('cannot close yesterday after 23:59: it stays missed clock out with a draft logbook', function () {
    $this->travelTo(Carbon::parse('2026-10-13 07:00:00'));
    // Login ulang: sesi kemarin sudah berakhir karena tidak aktif lebih dari 30 menit.
    $this->token = $this->intern->createToken('api')->plainTextToken;

    clockOut()->assertJsonPath('reason', 'before_work_end');

    expect($this->attendance->refresh()->clock_out_at)->toBeNull()
        ->and($this->logbook->refresh()->status)->toBe(LogbookStatus::Draft);

    $this->getJson('/api/intern/attendance/days/2026-10-12')
        ->assertJsonPath('data.status', 'present')
        ->assertJsonPath('data.missed_clock_out', true)
        ->assertJsonPath('data.logbook_state', 'draft');
});

describe('clock out tanpa clock in (Lupa Clock In)', function () {
    beforeEach(function () {
        $this->attendance->delete();
    });

    it('creates the attendance and the logbook in one request', function () {
        clockOut(['work' => 'Membantu tim operasional.', 'notes' => null])
            ->assertOk()
            ->assertJsonPath('data.status', 'missed_clock_in')
            ->assertJsonPath('data.clock_in_at', null)
            ->assertJsonPath('data.clock_out_at', '17:03')
            ->assertJsonPath('data.clock_in_office', null)
            ->assertJsonPath('data.clock_out_office.id', $this->office->id)
            ->assertJsonPath('data.logbook_status', 'pending_review');

        $attendance = Attendance::sole();
        expect($attendance->only(['clock_in_at', 'scheduled_start', 'scheduled_end', 'late_tolerance_minutes']))->toBe([
            'clock_in_at' => null,
            'scheduled_start' => '08:00:00',
            'scheduled_end' => '17:00:00',
            'late_tolerance_minutes' => 15,
        ])
            ->and($attendance->logbook?->work)->toBe('Membantu tim operasional.');

        $this->getJson('/api/intern/dashboard')
            ->assertJsonPath('data.today.state', 'clocked_out')
            ->assertJsonPath('data.today.status', 'missed_clock_in');
    });

    it('requires the logbook', function () {
        clockOut()
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'logbook_missing');

        expect(Attendance::count())->toBe(0);
    });

    it('is not possible before the end of work hours', function () {
        $this->travelTo(Carbon::parse('2026-10-12 16:30:00'));

        clockOut(['work' => 'Isi.'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Belum saatnya clock out, tunggu 30 menit lagi.');

        expect(Attendance::count())->toBe(0);
    });

    it('still checks the location', function () {
        clockOut(['work' => 'Isi.'], lat: -6.1256 + 0.004)->assertJsonPath('reason', 'outside_radius');

        expect(Attendance::count())->toBe(0);
    });

    it('is rejected on a holiday and on approved leave', function (Closure $setup, string $reason) {
        $setup($this);

        clockOut(['work' => 'Isi.'])->assertUnprocessable()->assertJsonPath('reason', $reason);
    })->with([
        'libur' => [fn ($test) => Holiday::factory()->create(['date' => '2026-10-12']), 'holiday'],
        'izin' => [fn ($test) => LeaveRequest::factory()->for($test->intern, 'intern')->approved()->create(['start_date' => '2026-10-12', 'end_date' => '2026-10-12']), 'on_leave'],
    ]);
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
