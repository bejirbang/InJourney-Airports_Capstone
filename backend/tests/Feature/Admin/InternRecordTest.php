<?php

use App\Enums\AttendanceStatus;
use App\Enums\CorrectionStatus;
use App\Enums\LeaveType;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\LeaveRequest;
use App\Models\Logbook;
use App\Models\Office;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Dedi Admin']);
    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->intern = User::factory()->intern([
        'mentor_id' => $this->mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create(['name' => 'Andi Pratama']);

});

function adminGet(User $admin, string $uri): TestResponse
{
    app('auth')->forgetGuards();

    return test()->getJson($uri, ['Authorization' => 'Bearer '.$admin->createToken('api')->plainTextToken]);
}

it('shows the monthly attendance with statuses, logbook text, and active corrections', function () {
    $office = Office::factory()->create(['name' => 'Kantor Pusat Terminal 3']);
    $friday = Attendance::factory()->for($this->intern, 'intern')->create([
        'date' => '2026-10-09', 'clock_in_at' => '08:45:00', 'clock_in_office_id' => $office->id, 'is_corrected' => true,
    ]);
    Logbook::factory()->pendingReview()->create(['attendance_id' => $friday->id, 'work' => 'Menyusun laporan API.']);
    Attendance::factory()->for($this->intern, 'intern')->clockedIn()->create(['date' => '2026-10-08', 'clock_in_at' => '08:30:00']);
    AttendanceCorrection::factory()->for($this->intern, 'intern')->pendingAdmin()->create(['date' => '2026-10-08']);

    $response = adminGet($this->admin, "/api/admin/users/{$this->intern->id}/attendance?month=2026-10")
        ->assertOk()
        ->assertJsonPath('data.month', '2026-10')
        ->assertJsonPath('data.selectable_months', ['first' => '2026-09', 'last' => '2026-10'])
        ->assertJsonPath('data.recap.late', 1)
        ->assertJsonPath('data.recap.missed_clock_out', 1)
        ->assertJsonPath('data.recap.corrected', 1)
        ->assertJsonPath('data.days.0.date', '2026-10-12');

    $days = collect($response->json('data.days'))->keyBy('date');

    expect($days['2026-10-09'])->toBe([
        'date' => '2026-10-09',
        'status' => 'present',
        'clock_in_at' => '08:45',
        'clock_out_at' => '17:00',
        'late_minutes' => null,
        'missed_clock_out' => false,
        'is_corrected' => true,
        'logbook_state' => 'pending_review',
        'holiday_name' => null,
        'leave_type' => null,
        'logbook_work' => 'Menyusun laporan API.',
        'has_active_correction' => false,
    ])
        ->and($days['2026-10-08'])->toMatchArray([
            'status' => 'late',
            'late_minutes' => 30,
            'missed_clock_out' => true,
            'has_active_correction' => true,
            'logbook_work' => null,
        ]);

    adminGet($this->admin, "/api/admin/users/{$this->intern->id}/attendance?month=2026-10&status=late")
        ->assertJsonPath('data.days.*.date', ['2026-10-08']);

    adminGet($this->admin, "/api/admin/users/{$this->intern->id}/attendance/days/2026-10-09")
        ->assertOk()
        ->assertJsonPath('data.is_corrected', true)
        ->assertJsonPath('data.clock_in_office', ['id' => $office->id, 'name' => 'Kantor Pusat Terminal 3'])
        ->assertJsonPath('data.logbook.work', 'Menyusun laporan API.');
});

it('rejects a month outside the internship period', function () {
    adminGet($this->admin, "/api/admin/users/{$this->intern->id}/attendance?month=2026-08")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['month' => 'Bulan di luar periode magang.']);
});

it('lists the leave history with who decided it and the note', function () {
    $approved = LeaveRequest::factory()->for($this->intern, 'intern')->approved()->create([
        'start_date' => '2026-10-01', 'end_date' => '2026-10-02', 'decided_by' => $this->mentor->id,
        'decision_note' => 'Semoga lekas sembuh.', 'created_at' => '2026-09-30 08:00:00', 'evidence_url' => 'https://drive.google.com/file/d/surat/view',
    ]);
    $pending = LeaveRequest::factory()->for($this->intern, 'intern')->create([
        'type' => LeaveType::Urgent, 'start_date' => '2026-10-15', 'end_date' => '2026-10-15', 'created_at' => '2026-10-12 09:00:00',
    ]);

    adminGet($this->admin, "/api/admin/users/{$this->intern->id}/leaves")
        ->assertOk()
        ->assertJsonPath('data.0.id', $pending->id)
        ->assertJsonPath('data.0.status', 'pending')
        ->assertJsonPath('data.0.decided_by', null)
        ->assertJsonPath('data.1', [
            'id' => $approved->id,
            'type' => 'sick',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-02',
            'working_days' => 2,
            'status' => 'approved',
            'evidence_url' => 'https://drive.google.com/file/d/surat/view',
            'submitted_at' => '2026-09-30T08:00:00+07:00',
            'decided_by' => ['name' => 'Sari Wijaya', 'role' => 'mentor'],
            'decision_note' => 'Semoga lekas sembuh.',
            'decided_at' => '2026-10-12T14:39:00+07:00',
        ]);
});

it('lists the correction history with the mentor and admin notes', function () {
    $rejected = AttendanceCorrection::factory()->for($this->intern, 'intern')
        ->decidedByAdmin(CorrectionStatus::RejectedByAdmin, $this->admin, 'Tanggal ini sudah dikoreksi.')
        ->create(['date' => '2026-10-02', 'recorded_status' => AttendanceStatus::Late, 'created_at' => '2026-10-03 08:05:00']);

    adminGet($this->admin, "/api/admin/users/{$this->intern->id}/corrections")
        ->assertOk()
        ->assertExactJson(['data' => [[
            'id' => $rejected->id,
            'date' => '2026-10-02',
            'submitted_at' => '2026-10-03T08:05:00+07:00',
            'status' => 'rejected_by_admin',
            'recorded_status' => 'late',
            'recorded_missed_clock_out' => true,
            'reason' => 'Lupa clock out.',
            'mentor' => 'Sari Wijaya',
            'mentor_note' => 'Benar, intern hadir.',
            'mentor_decided_at' => '2026-10-12T14:39:00+07:00',
            'admin' => 'Dedi Admin',
            'admin_note' => 'Tanggal ini sudah dikoreksi.',
            'admin_decided_at' => '2026-10-12T14:39:00+07:00',
        ]]]);
});

it('rejects the intern tabs for a mentor or admin account', function (string $tab) {
    adminGet($this->admin, "/api/admin/users/{$this->mentor->id}/{$tab}")
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'not_intern')
        ->assertJsonPath('message', 'Akun ini bukan intern.');
})->with(['attendance', 'leaves', 'corrections', 'warnings']);

it('rejects interns and mentors from the intern tabs', function (string $role) {
    adminGet(User::factory()->{$role}()->create(), "/api/admin/users/{$this->intern->id}/attendance")
        ->assertForbidden();
})->with(['intern', 'mentor']);
