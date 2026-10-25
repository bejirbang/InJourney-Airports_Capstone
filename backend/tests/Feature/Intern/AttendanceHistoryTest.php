<?php

use App\Enums\AttendanceStatus;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\Logbook;
use App\Models\Office;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->intern = User::factory()->intern([
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create();
    $this->token = $this->intern->createToken('api')->plainTextToken;
});

function history(string $query = '')
{
    return test()->getJson('/api/intern/attendance'.$query, [
        'Authorization' => 'Bearer '.test()->token,
    ]);
}

function historyDay(string $date)
{
    return test()->getJson("/api/intern/attendance/days/{$date}", [
        'Authorization' => 'Bearer '.test()->token,
    ]);
}

/**
 * Oktober: 1 Hadir, 2 Hadir + Lupa Clock Out, 5 Izin, 6 Hadir (Dikoreksi), 7 Tidak Hadir,
 * 8 Terlambat 30 menit, 9 libur, 12 hari ini (sudah clock in).
 */
function seedOctober(User $intern, Office $office): void
{
    $attend = fn (string $date, string $in, ?string $out, array $extra = []) => Attendance::factory()
        ->for($intern, 'intern')
        ->create(['date' => $date, 'clock_in_at' => $in, 'clock_out_at' => $out, 'clock_in_office_id' => $office->id, ...$extra]);

    Logbook::factory()->approved()->for($attend('2026-10-01', '08:10:00', '17:05:00', ['clock_out_office_id' => $office->id]))
        ->create(['work' => 'Menyusun ERD.', 'notes' => null, 'submitted_at' => '2026-10-01 17:05:00']);
    Logbook::factory()->for($attend('2026-10-02', '08:00:00', null))->create();
    LeaveRequest::factory()->for($intern, 'intern')->approved()->create(['start_date' => '2026-10-05', 'end_date' => '2026-10-05']);
    $attend('2026-10-06', '08:00:00', '17:00:00', ['is_corrected' => true]);
    Logbook::factory()->pendingReview()->for($attend('2026-10-08', '08:30:00', '17:00:00'))->create();
    Holiday::factory()->create(['date' => '2026-10-09', 'name' => 'Cuti Bersama']);
    $attend('2026-10-12', '08:00:00', null);
}

it('returns the current month with a recap of final statuses', function () {
    seedOctober($this->intern, Office::factory()->create());

    history()
        ->assertOk()
        ->assertJsonPath('data.month', '2026-10')
        ->assertJsonPath('data.selectable_months', ['first' => '2026-09', 'last' => '2026-10'])
        ->assertJsonPath('data.recap', [
            'month' => '2026-10',
            'present' => 3,
            'late' => 1,
            'missed_clock_in' => 0,
            'leave' => 1,
            'absent' => 1,
            'missed_clock_out' => 1,
            'corrected' => 1,
            'working_days' => 6,
        ]);
});

it('lists every day up to today, newest first, with its status and marks', function () {
    seedOctober($this->intern, Office::factory()->create());

    $days = collect(history()->json('data.days'))->keyBy('date');

    expect($days->map->status->all())->toBe([
        '2026-10-12' => 'present',
        '2026-10-11' => 'holiday',
        '2026-10-10' => 'holiday',
        '2026-10-09' => 'holiday',
        '2026-10-08' => 'late',
        '2026-10-07' => 'absent',
        '2026-10-06' => 'present',
        '2026-10-05' => 'leave',
        '2026-10-04' => 'holiday',
        '2026-10-03' => 'holiday',
        '2026-10-02' => 'present',
        '2026-10-01' => 'present',
    ]);

    expect($days['2026-10-01'])->toBe([
        'date' => '2026-10-01',
        'status' => 'present',
        'clock_in_at' => '08:10',
        'clock_out_at' => '17:05',
        'late_minutes' => null,
        'missed_clock_out' => false,
        'is_corrected' => false,
        'logbook_state' => 'approved',
        'holiday_name' => null,
        'leave_type' => null,
        'has_active_correction' => false,
        'can_request_correction' => false,
    ])
        ->and($days['2026-10-02']['missed_clock_out'])->toBeTrue()
        ->and($days['2026-10-02']['logbook_state'])->toBe('draft')
        ->and($days['2026-10-06']['is_corrected'])->toBeTrue()
        ->and($days['2026-10-06']['logbook_state'])->toBe('missing')
        ->and($days['2026-10-08']['late_minutes'])->toBe(30)
        ->and($days['2026-10-09']['holiday_name'])->toBe('Cuti Bersama')
        ->and($days['2026-10-10']['holiday_name'])->toBeNull()
        ->and($days['2026-10-05']['leave_type'])->toBe('sick')
        ->and($days['2026-10-07']['logbook_state'])->toBeNull()
        ->and($days['2026-10-12']['missed_clock_out'])->toBeFalse();
});

it('offers correction on past days that are late, missed clock in, absent, or missed clock out', function () {
    seedOctober($this->intern, Office::factory()->create());
    Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-09-30', 'clock_in_at' => null]);

    $correctable = fn (string $query) => collect(history($query)->json('data.days'))
        ->filter(fn (array $day) => $day['can_request_correction'])
        ->pluck('date')
        ->all();

    expect($correctable(''))->toBe(['2026-10-08', '2026-10-07', '2026-10-02'])
        ->and($correctable('?month=2026-09&status=missed_clock_in'))->toBe(['2026-09-30']);
});

it('marks a date that already has an active correction', function () {
    seedOctober($this->intern, Office::factory()->create());
    AttendanceCorrection::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-07', 'recorded_status' => AttendanceStatus::Absent]);
    AttendanceCorrection::factory()->for($this->intern, 'intern')->rejectedByMentor()->create(['date' => '2026-10-08', 'recorded_status' => AttendanceStatus::Late]);

    $days = collect(history()->json('data.days'))->keyBy('date');

    expect($days['2026-10-07'])->toMatchArray(['has_active_correction' => true, 'can_request_correction' => false])
        ->and($days['2026-10-08'])->toMatchArray(['has_active_correction' => false, 'can_request_correction' => true]);
});

it('filters the days by status or by the missed clock out mark, keeping the full recap', function (string $status, array $dates) {
    seedOctober($this->intern, Office::factory()->create());

    $response = history("?status={$status}")->assertOk();

    expect(array_column($response->json('data.days'), 'date'))->toBe($dates)
        ->and($response->json('data.recap.working_days'))->toBe(6);
})->with([
    ['present', ['2026-10-12', '2026-10-06', '2026-10-02', '2026-10-01']],
    ['late', ['2026-10-08']],
    ['absent', ['2026-10-07']],
    ['leave', ['2026-10-05']],
    ['missed_clock_out', ['2026-10-02']],
    ['missed_clock_in', []],
]);

it('rejects an unknown status filter', function () {
    history('?status=ongoing')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status' => 'Filter status tidak valid.']);
});

it('shows a missed clock in day as attended in the recap', function () {
    Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-07', 'clock_in_at' => null, 'clock_out_at' => '17:10:00']);

    $response = history('?status=missed_clock_in')->assertOk();

    expect($response->json('data.days.0'))->toMatchArray([
        'date' => '2026-10-07',
        'status' => 'missed_clock_in',
        'clock_in_at' => null,
        'clock_out_at' => '17:10',
        'missed_clock_out' => false,
    ])
        ->and($response->json('data.recap.missed_clock_in'))->toBe(1);
});

it('keeps the status of a past day when the tolerance setting changes later', function () {
    Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-07', 'clock_in_at' => '08:10:00', 'late_tolerance_minutes' => 5]);

    expect(collect(history()->json('data.days'))->firstWhere('date', '2026-10-07')['status'])->toBe('late');
});

it('lets an attended day win over an approved leave', function () {
    LeaveRequest::factory()->for($this->intern, 'intern')->approved()->create(['start_date' => '2026-10-07', 'end_date' => '2026-10-07']);
    Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-07']);

    expect(collect(history()->json('data.days'))->firstWhere('date', '2026-10-07'))->toMatchArray(['status' => 'present', 'leave_type' => null]);
});

it('shows a past month in full', function () {
    $response = history('?month=2026-09')->assertOk();

    expect($response->json('data.days'))->toHaveCount(30)
        ->and($response->json('data.recap.absent'))->toBe(22)
        ->and($response->json('data.recap.working_days'))->toBe(22);
});

it('starts the first month at the internship start date', function () {
    $this->intern->internProfile->update(['start_date' => '2026-10-08']);

    $response = history()->assertOk();

    expect(array_column($response->json('data.days'), 'date'))->toBe([
        '2026-10-12', '2026-10-11', '2026-10-10', '2026-10-09', '2026-10-08',
    ])
        ->and($response->json('data.selectable_months.first'))->toBe('2026-10');
});

it('rejects months outside the internship period or in the future', function (string $month) {
    history("?month={$month}")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['month' => 'Bulan di luar periode magang.']);
})->with(['2026-08', '2026-11']);

it('rejects an invalid month format', function () {
    history('?month=Oktober')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['month' => 'Format bulan tidak valid.']);
});

it('only shows the intern’s own attendance', function () {
    $other = User::factory()->intern(['start_date' => '2026-09-01', 'end_date' => '2026-12-31'])->create();
    Attendance::factory()->for($other, 'intern')->create(['date' => '2026-10-07']);

    $day = collect(history()->json('data.days'))->firstWhere('date', '2026-10-07');

    expect($day['status'])->toBe('absent');
});

it('shows the read-only detail of one day with its logbook and copied schedule', function () {
    $office = Office::factory()->create(['name' => 'Terminal 3']);
    seedOctober($this->intern, $office);

    historyDay('2026-10-01')
        ->assertOk()
        ->assertJsonPath('data.status', 'present')
        ->assertJsonPath('data.clock_in_at', '08:10')
        ->assertJsonPath('data.late_minutes', null)
        ->assertJsonPath('data.scheduled', ['start' => '08:00', 'end' => '17:00'])
        ->assertJsonPath('data.clock_in_office', ['id' => $office->id, 'name' => 'Terminal 3'])
        ->assertJsonPath('data.clock_out_office.id', $office->id)
        ->assertJsonPath('data.logbook', [
            'work' => 'Menyusun ERD.',
            'notes' => null,
            'status' => 'approved',
            'submitted_at' => '2026-10-01T17:05:00+07:00',
        ]);
});

it('shows a day without attendance', function () {
    historyDay('2026-10-07')
        ->assertOk()
        ->assertJsonPath('data.status', 'absent')
        ->assertJsonPath('data.scheduled', null)
        ->assertJsonPath('data.clock_in_office', null)
        ->assertJsonPath('data.logbook', null);
});

it('rejects a day outside the period, in the future, or not a real date', function (string $date) {
    historyDay($date)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['date' => 'Tanggal di luar periode magang atau belum berjalan.']);
})->with(['2026-08-31', '2026-10-13', '2026-02-30', 'kemarin']);

it('rejects mentors and admins', function (string $role) {
    $user = User::factory()->{$role}()->create();

    $this->getJson('/api/intern/attendance', ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken])
        ->assertForbidden();
})->with(['mentor', 'admin']);

it('rejects requests without a token', function () {
    $this->getJson('/api/intern/attendance')->assertUnauthorized();
    $this->getJson('/api/intern/attendance/days/2026-10-01')->assertUnauthorized();
});
