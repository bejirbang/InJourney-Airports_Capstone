<?php

use App\Models\Airport;
use App\Models\Attendance;
use App\Models\LeaveRequest;
use App\Models\Logbook;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

// Hari kerja final Oktober sampai kemarin: 1, 2, 5, 6, 7, 8, 9 (7 hari).
beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->admin = User::factory()->admin()->create();
    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->soetta = Airport::factory()->create(['name' => 'Soekarno-Hatta']);
    $this->rina = attendee($this, 'Rina Wulandari');
});

function attendee($test, string $name, array $profile = [], array $attributes = []): User
{
    return User::factory()->intern([
        'mentor_id' => $test->mentor->id,
        'airport_id' => $test->soetta->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
        ...$profile,
    ])->create(['name' => $name, 'email' => mb_strtolower(explode(' ', $name)[0]).'@injourney.test', ...$attributes]);
}

function adminAttendance(User $user, string $uri): TestResponse
{
    app('auth')->forgetGuards();

    return test()->getJson($uri, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

it('shows the monthly recap and attendance rate of every intern', function () {
    foreach (['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'] as $date) {
        Attendance::factory()->for($this->rina, 'intern')->create(['date' => $date]);
    }
    Attendance::factory()->for($this->rina, 'intern')->create(['date' => '2026-10-07', 'clock_in_at' => '08:40:00']);
    LeaveRequest::factory()->for($this->rina, 'intern')->approved()->create(['start_date' => '2026-10-08', 'end_date' => '2026-10-08']);
    attendee($this, 'Belum Mulai', ['start_date' => '2026-11-02']);

    adminAttendance($this->admin, '/api/admin/attendance?month=2026-10')
        ->assertOk()
        ->assertJsonPath('data.month', '2026-10')
        ->assertJsonPath('data.selectable_months', ['first' => '2026-09', 'last' => '2026-10'])
        ->assertJsonPath('data.interns', [[
            'intern' => ['id' => $this->rina->id, 'name' => 'Rina Wulandari', 'short_name' => 'Rina W.'],
            'airport' => ['id' => $this->soetta->id, 'name' => 'Soekarno-Hatta'],
            'mentor' => ['id' => $this->mentor->id, 'name' => 'Sari Wijaya'],
            'recap' => [
                'present' => 4, 'late' => 1, 'missed_clock_in' => 0, 'leave' => 1, 'absent' => 1,
                'missed_clock_out' => 0, 'corrected' => 0, 'working_days' => 7,
            ],
            // 5 hadir dari (7 - 1) hari.
            'attendance_rate' => 83,
        ]]);
});

it('filters the recap by airport and by name or email', function () {
    $budi = attendee($this, 'Budi Kurniawan', ['airport_id' => Airport::factory()->create()->id]);

    adminAttendance($this->admin, "/api/admin/attendance?airport_id={$this->soetta->id}")->assertJsonPath('data.interns.*.intern.id', [$this->rina->id]);
    adminAttendance($this->admin, '/api/admin/attendance?q=BUDI@')->assertJsonPath('data.interns.*.intern.id', [$budi->id]);
});

it('lists the status of every intern on one date, including interns off at their airport', function () {
    Attendance::factory()->for($this->rina, 'intern')->clockedIn()->create(['date' => '2026-10-09', 'clock_in_at' => '08:20:00']);
    $budi = attendee($this, 'Budi Kurniawan');

    adminAttendance($this->admin, '/api/admin/attendance/daily?date=2026-10-09')
        ->assertOk()
        ->assertJsonPath('data.date', '2026-10-09')
        ->assertJsonPath('data.counts.late', 1)
        ->assertJsonPath('data.counts.absent', 1)
        ->assertJsonPath('data.counts.missed_clock_out', 1)
        ->assertJsonPath('data.interns.*.intern.id', [$budi->id, $this->rina->id])
        ->assertJsonPath('data.interns.1', [
            'intern' => ['id' => $this->rina->id, 'name' => 'Rina Wulandari', 'short_name' => 'Rina W.'],
            'status' => 'late',
            'clock_in_at' => '08:20',
            'late_minutes' => 20,
            'missed_clock_out' => true,
            'leave_type' => null,
            'clock_out_at' => null,
            'is_corrected' => false,
            'airport' => ['id' => $this->soetta->id, 'name' => 'Soekarno-Hatta'],
        ]);

    adminAttendance($this->admin, '/api/admin/attendance/daily?date=2026-10-10')->assertJsonPath('data.counts.holiday', 2);
    adminAttendance($this->admin, '/api/admin/attendance/daily?date=2026-10-13')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['date' => 'Pilih tanggal hari ini atau sebelumnya.']);
});

it('shows the logbooks of an intern read-only in the account detail', function () {
    Logbook::factory()->pendingReview()->for(Attendance::factory()->for($this->rina, 'intern')->create(['date' => '2026-10-09']))->create(['work' => 'Menyusun ERD.']);

    adminAttendance($this->admin, "/api/admin/users/{$this->rina->id}/logbooks?month=2026-10")
        ->assertOk()
        ->assertJsonPath('data.days.1.date', '2026-10-09')
        ->assertJsonPath('data.days.1.logbook_state', 'pending_review')
        ->assertJsonPath('data.days.1.logbook.work', 'Menyusun ERD.');
    adminAttendance($this->admin, "/api/admin/users/{$this->mentor->id}/logbooks")->assertUnprocessable()->assertJsonPath('reason', 'not_intern');
});

it('rejects interns and mentors', function (string $role) {
    adminAttendance(User::factory()->{$role}()->create(), '/api/admin/attendance')->assertForbidden();
})->with(['intern', 'mentor']);
