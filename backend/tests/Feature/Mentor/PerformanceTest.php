<?php

use App\Models\Attendance;
use App\Models\LeaveRequest;
use App\Models\Logbook;
use App\Models\LogbookReview;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

// Hari kerja final Oktober sampai kemarin: 1, 2, 5, 6, 7, 8, 9 (7 hari).
beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->mentor = User::factory()->mentor()->create();
});

function performanceIntern(User $mentor, string $name, string $start = '2026-09-01', array $attributes = []): User
{
    return User::factory()->intern([
        'mentor_id' => $mentor->id,
        'start_date' => $start,
        'end_date' => '2026-12-31',
    ])->create(['name' => $name, ...$attributes]);
}

function presentOn(User $intern, string $date, bool $report = true, ?string $out = '17:00:00'): void
{
    $attendance = Attendance::factory()->for($intern, 'intern')->create(['date' => $date, 'clock_in_at' => '08:10:00', 'clock_out_at' => $out]);

    if ($report) {
        Logbook::factory()->approved()->for($attendance)->create();
    }
}

function performance(User $mentor, string $query = ''): TestResponse
{
    app('auth')->forgetGuards();

    return test()->getJson('/api/mentor/performance'.$query, ['Authorization' => 'Bearer '.$mentor->createToken('api')->plainTextToken]);
}

it('computes the monthly recap, the KPI, and the dates behind each number', function () {
    $andi = performanceIntern($this->mentor, 'Andi Pratama');
    foreach (['2026-10-01', '2026-10-02', '2026-10-05'] as $date) {
        presentOn($andi, $date);
    }
    $revised = Logbook::query()->whereHas('attendance', fn ($q) => $q->whereDate('date', '2026-10-02'))->sole();
    LogbookReview::factory()->create(['logbook_id' => $revised->id, 'mentor_id' => $this->mentor->id, 'action' => 'revision', 'comment' => 'Lengkapi.']);
    presentOn($andi, '2026-10-06', report: false);
    LeaveRequest::factory()->for($andi, 'intern')->approved()->create(['start_date' => '2026-10-07', 'end_date' => '2026-10-07']);
    presentOn($andi, '2026-10-08', out: null);

    performance($this->mentor, '?month=2026-10')
        ->assertOk()
        ->assertJsonPath('data.month', '2026-10')
        ->assertJsonPath('data.selectable_months', ['first' => '2026-09', 'last' => '2026-10'])
        ->assertJsonPath('data.interns_total', 1)
        ->assertJsonPath('data.interns.0', [
            'intern' => ['id' => $andi->id, 'name' => 'Andi Pratama', 'short_name' => 'Andi P.'],
            'is_active' => true,
            'recap' => ['present' => 5, 'late' => 0, 'missed_clock_in' => 0, 'missed_clock_out' => 1, 'leave' => 1, 'absent' => 1, 'working_days' => 7],
            'kpi' => [
                'enough_data' => true,
                // 5 / (7 - 1); hari Lupa Clock Out tetap terhitung hadir.
                'attendance_rate' => 83,
                'on_time_rate' => 100,
                // 4 dari 5 hari berpresensi; 6 Okt tanpa logbook.
                'logbook_approved_rate' => 80,
                'logbook_revisions' => 1,
            ],
            'dates' => [
                'present' => ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-08'],
                'late' => [],
                'missed_clock_in' => [],
                'missed_clock_out' => ['2026-10-08'],
                'leave' => ['2026-10-07'],
                'absent' => ['2026-10-09'],
                'logbook_not_approved' => ['2026-10-06'],
                'logbook_revisions' => ['2026-10-02'],
            ],
        ])
        ->assertJsonPath('data.summary', ['attendance_rate' => 83, 'on_time_rate' => 100, 'logbook_approved_rate' => 80]);
});

it('marks interns with less than five working days as not enough data and leaves them out of the summary', function () {
    $andi = performanceIntern($this->mentor, 'Andi Pratama');
    foreach (['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'] as $date) {
        presentOn($andi, $date);
    }
    $rina = performanceIntern($this->mentor, 'Rina Wulandari', '2026-10-08');
    presentOn($rina, '2026-10-08', report: false);

    $response = performance($this->mentor)
        ->assertOk()
        ->assertJsonPath('data.summary', ['attendance_rate' => 100, 'on_time_rate' => 100, 'logbook_approved_rate' => 100]);

    $rows = collect($response->json('data.interns'))->keyBy('intern.name');
    expect($rows['Rina Wulandari']['kpi']['enough_data'])->toBeFalse()
        ->and($rows['Rina Wulandari']['recap']['working_days'])->toBe(2);
});

it('leaves out interns without data in the month and labels inactive interns', function () {
    performanceIntern($this->mentor, 'Belum Mulai', '2026-11-02');
    performanceIntern($this->mentor, 'Nonaktif', attributes: ['is_active' => false]);
    User::factory()->intern()->create(['name' => 'Bukan bimbingan']);

    $response = performance($this->mentor)
        ->assertOk()
        ->assertJsonPath('data.interns_total', 2)
        ->assertJsonCount(1, 'data.interns')
        ->assertJsonPath('data.interns.0.intern.name', 'Nonaktif')
        ->assertJsonPath('data.interns.0.is_active', false)
        ->assertJsonPath('data.interns.0.recap.absent', 7);

    expect($response->json('data.interns.0.kpi.attendance_rate'))->toBe(0);
});

it('filters by intern', function () {
    $andi = performanceIntern($this->mentor, 'Andi Pratama');
    performanceIntern($this->mentor, 'Rina Wulandari');

    performance($this->mentor, "?intern_id={$andi->id}")
        ->assertOk()
        ->assertJsonCount(1, 'data.interns')
        ->assertJsonPath('data.interns.0.intern.id', $andi->id);
});

it('returns an empty page for a mentor without interns', function () {
    performance($this->mentor)
        ->assertOk()
        ->assertJsonPath('data.interns_total', 0)
        ->assertJsonPath('data.selectable_months', null)
        ->assertJsonPath('data.interns', [])
        ->assertJsonPath('data.summary', ['attendance_rate' => null, 'on_time_rate' => null, 'logbook_approved_rate' => null]);
});

it('counts late and missed clock in days as attended', function () {
    $andi = performanceIntern($this->mentor, 'Andi Pratama');
    Attendance::factory()->for($andi, 'intern')->create(['date' => '2026-10-01', 'clock_in_at' => '08:40:00']);
    Attendance::factory()->for($andi, 'intern')->create(['date' => '2026-10-02', 'clock_in_at' => null]);

    $row = performance($this->mentor)->assertOk()->json('data.interns.0');

    expect($row['recap'])->toMatchArray(['present' => 0, 'late' => 1, 'missed_clock_in' => 1, 'absent' => 5])
        // 2 hadir dari 7 hari kerja.
        ->and($row['kpi']['attendance_rate'])->toBe(29)
        // Lupa Clock In tidak dihitung di Tepat waktu karena tidak ada jam masuk.
        ->and($row['kpi']['on_time_rate'])->toBe(0);
});

it('rejects an invalid month and other roles', function () {
    performance($this->mentor, '?month=2026-13')->assertUnprocessable();

    app('auth')->forgetGuards();
    performance(User::factory()->intern()->create())->assertForbidden();
});
