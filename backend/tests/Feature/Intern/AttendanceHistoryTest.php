<?php

use App\Models\Attendance;
use App\Models\DailyReport;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\Office;
use App\Models\User;
use App\Models\WorkHourSetting;
use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));
    WorkHourSetting::factory()->create(['effective_from' => '2026-01-01']);

    $this->intern = User::factory()->intern([
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create();
    $this->token = $this->intern->createToken('api')->plainTextToken;
});

function history(?string $month = null)
{
    return test()->getJson('/api/intern/attendance'.($month === null ? '' : "?month={$month}"), [
        'Authorization' => 'Bearer '.test()->token,
    ]);
}

function historyDay(string $date)
{
    return test()->getJson("/api/intern/attendance/days/{$date}", [
        'Authorization' => 'Bearer '.test()->token,
    ]);
}

function seedOctober(User $intern, Office $office): void
{
    $attend = fn (string $date, string $in, ?string $out, array $extra = []) => Attendance::factory()
        ->for($intern, 'intern')
        ->create(['date' => $date, 'clock_in_at' => $in, 'clock_out_at' => $out, 'clock_in_office_id' => $office->id, ...$extra]);

    DailyReport::factory()->for($attend('2026-10-01', '08:10:00', '17:05:00', ['clock_out_office_id' => $office->id]))
        ->create(['work' => 'Menyusun ERD.', 'notes' => null, 'sent_at' => '2026-10-01 16:00:00']);
    $attend('2026-10-02', '08:00:00', null);
    LeaveRequest::factory()->for($intern, 'intern')->approved()->create(['start_date' => '2026-10-05', 'end_date' => '2026-10-05']);
    $attend('2026-10-06', '08:00:00', '17:00:00', ['is_corrected' => true]);
    $attend('2026-10-08', '07:58:00', '17:00:00');
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
            'leave' => 1,
            'absent' => 1,
            'missed_clock_out' => 1,
            'late' => 1,
            'working_days' => 6,
        ]);
});

it('lists every day up to today, newest first, with its status', function () {
    seedOctober($this->intern, Office::factory()->create());

    $days = collect(history()->json('data.days'))->keyBy('date');

    expect($days->keys()->all())->toBe([
        '2026-10-12', '2026-10-11', '2026-10-10', '2026-10-09', '2026-10-08', '2026-10-07',
        '2026-10-06', '2026-10-05', '2026-10-04', '2026-10-03', '2026-10-02', '2026-10-01',
    ])
        ->and($days->map->status->all())->toBe([
            '2026-10-12' => 'ongoing',
            '2026-10-11' => 'holiday',
            '2026-10-10' => 'holiday',
            '2026-10-09' => 'holiday',
            '2026-10-08' => 'present',
            '2026-10-07' => 'absent',
            '2026-10-06' => 'present',
            '2026-10-05' => 'leave',
            '2026-10-04' => 'holiday',
            '2026-10-03' => 'holiday',
            '2026-10-02' => 'missed_clock_out',
            '2026-10-01' => 'present',
        ]);

    expect($days['2026-10-01'])->toBe([
        'date' => '2026-10-01',
        'status' => 'present',
        'clock_in_at' => '08:10',
        'clock_out_at' => '17:05',
        'late_minutes' => 10,
        'is_corrected' => false,
        'daily_report_sent' => true,
        'holiday_name' => null,
        'leave_type' => null,
        'has_pending_correction' => false,
        'can_request_correction' => true,
    ])
        ->and($days['2026-10-06']['is_corrected'])->toBeTrue()
        ->and($days['2026-10-08']['late_minutes'])->toBe(0)
        ->and($days['2026-10-09']['holiday_name'])->toBe('Cuti Bersama')
        ->and($days['2026-10-10']['holiday_name'])->toBeNull()
        ->and($days['2026-10-05']['leave_type'])->toBe('sick')
        ->and($days['2026-10-07']['clock_in_at'])->toBeNull();
});

it('offers correction only on past working days that are not leave', function () {
    seedOctober($this->intern, Office::factory()->create());

    $correctable = collect(history()->json('data.days'))
        ->filter(fn (array $day) => $day['can_request_correction'])
        ->pluck('date')
        ->all();

    expect($correctable)->toBe(['2026-10-08', '2026-10-07', '2026-10-06', '2026-10-02', '2026-10-01']);
});

it('shows a past month in full', function () {
    $response = history('2026-09')->assertOk();

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
    history($month)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['month' => 'Bulan di luar periode magang.']);
})->with(['2026-08', '2026-11']);

it('rejects an invalid month format', function () {
    history('Oktober')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['month' => 'Format bulan tidak valid.']);
});

it('only shows the intern’s own attendance', function () {
    $other = User::factory()->intern(['start_date' => '2026-09-01', 'end_date' => '2026-12-31'])->create();
    Attendance::factory()->for($other, 'intern')->create(['date' => '2026-10-07']);

    $day = collect(history()->json('data.days'))->firstWhere('date', '2026-10-07');

    expect($day['status'])->toBe('absent');
});

it('shows the read-only detail of one day with its daily report', function () {
    $office = Office::factory()->create(['name' => 'Kantor Pusat Terminal 3']);
    seedOctober($this->intern, $office);

    historyDay('2026-10-01')
        ->assertOk()
        ->assertJsonPath('data.status', 'present')
        ->assertJsonPath('data.clock_in_at', '08:10')
        ->assertJsonPath('data.late_minutes', 10)
        ->assertJsonPath('data.clock_in_office', ['id' => $office->id, 'name' => 'Kantor Pusat Terminal 3'])
        ->assertJsonPath('data.clock_out_office.id', $office->id)
        ->assertJsonPath('data.daily_report', [
            'work' => 'Menyusun ERD.',
            'notes' => null,
            'sent_at' => '2026-10-01T16:00:00+07:00',
        ]);
});

it('shows a day without attendance', function () {
    historyDay('2026-10-07')
        ->assertOk()
        ->assertJsonPath('data.status', 'absent')
        ->assertJsonPath('data.clock_in_office', null)
        ->assertJsonPath('data.daily_report', null);
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
