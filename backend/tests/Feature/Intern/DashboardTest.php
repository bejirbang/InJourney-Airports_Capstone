<?php

use App\Enums\LeaveType;
use App\Enums\TodayState;
use App\Models\Announcement;
use App\Models\Attendance;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\Logbook;
use App\Models\User;
use App\Services\AttendanceCalendar;
use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->intern = User::factory()->intern([
        'mentor_id' => $this->mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create();
});

function dashboardFor(User $user)
{
    return test()->getJson('/api/intern/dashboard', [
        'Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken,
    ]);
}

function attend(User $intern, string $date, ?string $out = '17:00:00'): Attendance
{
    return Attendance::factory()->for($intern, 'intern')->create([
        'date' => $date,
        'clock_in_at' => '08:02:00',
        'clock_out_at' => $out,
    ]);
}

it('shows the intern period, mentor, and the date of today', function () {
    dashboardFor($this->intern)
        ->assertOk()
        ->assertJsonPath('data.date', '2026-10-12')
        ->assertJsonPath('data.internship', [
            'start_date' => '2026-09-01',
            'end_date' => '2026-12-31',
            'mentor' => ['id' => $this->mentor->id, 'name' => 'Sari Wijaya'],
        ]);
});

it('counts only final statuses of this month in the recap', function () {
    attend($this->intern, '2026-09-30');
    attend($this->intern, '2026-10-01');
    attend($this->intern, '2026-10-02', null);
    LeaveRequest::factory()->for($this->intern, 'intern')->approved()->create([
        'start_date' => '2026-10-05',
        'end_date' => '2026-10-06',
    ]);
    attend($this->intern, '2026-10-06');
    attend($this->intern, '2026-10-08');
    Holiday::factory()->create(['date' => '2026-10-09', 'name' => 'Cuti Bersama']);
    attend($this->intern, '2026-10-12', null);

    dashboardFor($this->intern)
        ->assertOk()
        ->assertJsonPath('data.monthly_recap', [
            'month' => '2026-10',
            'present' => 4,
            'late' => 0,
            'missed_clock_in' => 0,
            'leave' => 1,
            'absent' => 1,
            'missed_clock_out' => 1,
            'corrected' => 0,
            'working_days' => 6,
        ]);
});

it('counts late and missed clock in days separately in the recap', function () {
    Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-01', 'clock_in_at' => '08:20:00']);
    Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-02', 'clock_in_at' => '07:55:00']);
    Attendance::factory()->for($this->intern, 'intern')->clockedIn()->create(['date' => '2026-10-05', 'clock_in_at' => '08:30:00']);
    Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-06', 'clock_in_at' => null]);
    Attendance::factory()->for($this->intern, 'intern')->clockedIn()->create(['date' => '2026-10-12', 'clock_in_at' => '08:40:00']);

    dashboardFor($this->intern)
        ->assertJsonPath('data.monthly_recap.present', 1)
        ->assertJsonPath('data.monthly_recap.late', 2)
        ->assertJsonPath('data.monthly_recap.missed_clock_in', 1)
        ->assertJsonPath('data.monthly_recap.missed_clock_out', 1)
        ->assertJsonPath('data.today.status', 'late')
        ->assertJsonPath('data.today.late_minutes', 40);
});

it('lists the logbooks that need action', function () {
    $day = Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-08']);
    Logbook::factory()->revision()->for($day)->create();
    Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-06', 'is_corrected' => true]);

    dashboardFor($this->intern)->assertJsonPath('data.action_needed.logbooks', [
        ['date' => '2026-10-06', 'logbook_state' => 'missing', 'comment' => null],
        ['date' => '2026-10-08', 'logbook_state' => 'revision', 'comment' => null],
    ]);
});

it('does not count days before the internship started', function () {
    $intern = User::factory()->intern([
        'mentor_id' => $this->mentor->id,
        'start_date' => '2026-10-08',
        'end_date' => '2026-12-31',
    ])->create();

    // Hanya 8 dan 9 Okt (Kamis, Jumat) yang dihitung; 10 dan 11 Okt akhir pekan.
    dashboardFor($intern)
        ->assertJsonPath('data.monthly_recap.absent', 2)
        ->assertJsonPath('data.monthly_recap.working_days', 2);
});

it('asks for the logbook after clock in until it is filled', function () {
    $attendance = attend($this->intern, '2026-10-12', null);

    dashboardFor($this->intern)
        ->assertJsonPath('data.today.state', 'clocked_in')
        ->assertJsonPath('data.today.clock_in_at', '08:02')
        ->assertJsonPath('data.today.clock_out_at', null)
        ->assertJsonPath('data.today.logbook', null)
        ->assertJsonPath('data.logbook_reminder', true);

    Logbook::factory()->for($attendance)->create(['work' => 'Isi.']);

    dashboardFor($this->intern)
        ->assertJsonPath('data.today.logbook', ['status' => 'draft', 'work' => 'Isi.', 'notes' => null])
        ->assertJsonPath('data.logbook_reminder', false);
});

it('shows the clock out time once the day is done', function () {
    attend($this->intern, '2026-10-12', '17:03:00');

    dashboardFor($this->intern)
        ->assertJsonPath('data.today.state', 'clocked_out')
        ->assertJsonPath('data.today.clock_out_at', '17:03')
        ->assertJsonPath('data.today.can_clock_out', false)
        ->assertJsonPath('data.logbook_reminder', false);
});

it('shows not clocked in on a normal workday', function () {
    dashboardFor($this->intern)
        ->assertJsonPath('data.today.state', 'not_clocked_in')
        ->assertJsonPath('data.today.clock_in_at', null);
});

it('shows the holiday name on a holiday', function () {
    Holiday::factory()->create(['date' => '2026-10-12', 'name' => 'Libur Nasional']);

    dashboardFor($this->intern)
        ->assertJsonPath('data.today.state', 'holiday')
        ->assertJsonPath('data.today.holiday_name', 'Libur Nasional');
});

it('treats weekends as holidays without a name', function () {
    $this->travelTo(Carbon::parse('2026-10-17 09:00:00'));

    dashboardFor($this->intern)
        ->assertJsonPath('data.today.state', 'holiday')
        ->assertJsonPath('data.today.holiday_name', null);
});

it('shows approved leave for today but ignores pending leave', function () {
    $leave = LeaveRequest::factory()->for($this->intern, 'intern')->create([
        'type' => LeaveType::Urgent,
        'start_date' => '2026-10-12',
        'end_date' => '2026-10-13',
    ]);

    dashboardFor($this->intern)->assertJsonPath('data.today.state', 'not_clocked_in');

    $leave->update(['status' => 'approved']);

    dashboardFor($this->intern)
        ->assertJsonPath('data.today.state', 'on_leave')
        ->assertJsonPath('data.today.leave_type', 'urgent');
});

it('reports outside the internship period', function () {
    // Tidak bisa lewat API, karena middleware `active` menolak intern di luar periode.
    $this->intern->internProfile->update(['end_date' => '2026-10-11']);

    $today = app(AttendanceCalendar::class)->today($this->intern->refresh(), now());

    expect($today['state'])->toBe(TodayState::OutsidePeriod);
});

it('has no task summary', function () {
    dashboardFor($this->intern)->assertOk()->assertJsonMissingPath('data.tasks');
});

it('lists the three latest announcements for interns', function () {
    $admin = User::factory()->admin()->create(['name' => 'Dedi']);
    $make = fn (string $title, string $at, bool $forIntern = true) => Announcement::factory()
        ->for($admin, 'author')
        ->create(['title' => $title, 'for_intern' => $forIntern, 'created_at' => $at]);

    $make('Lama', '2026-10-01 09:00:00');
    $make('Kedua', '2026-10-05 09:00:00');
    $make('Ketiga', '2026-10-07 09:00:00');
    $make('Khusus mentor', '2026-10-11 09:00:00', forIntern: false);
    $make('Terbaru', '2026-10-10 09:00:00');

    $response = dashboardFor($this->intern)->assertOk();

    expect(array_column($response->json('data.announcements'), 'title'))->toBe(['Terbaru', 'Ketiga', 'Kedua'])
        ->and($response->json('data.announcements.0.author_name'))->toBe('Dedi');
});

it('rejects mentors and admins', function (string $role) {
    dashboardFor(User::factory()->{$role}()->create())
        ->assertForbidden()
        ->assertJsonPath('message', 'Anda tidak memiliki akses.');
})->with(['mentor', 'admin']);

it('rejects an intern who has not changed the temporary password', function () {
    $this->intern->update(['must_change_password' => true]);

    dashboardFor($this->intern)
        ->assertForbidden()
        ->assertJsonPath('must_change_password', true);
});

it('rejects requests without a token', function () {
    $this->getJson('/api/intern/dashboard')->assertUnauthorized();
});
