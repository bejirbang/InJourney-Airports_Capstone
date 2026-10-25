<?php

use App\Enums\CorrectionStatus;
use App\Enums\LeaveType;
use App\Models\Airport;
use App\Models\AirportWeeklySchedule;
use App\Models\Assessment;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\FinalPresentation;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\Office;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->admin = User::factory()->admin()->create();
    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
});

function adminDashboard(User $admin, string $query = ''): TestResponse
{
    app('auth')->forgetGuards();

    return test()->getJson('/api/admin/dashboard'.$query, [
        'Authorization' => 'Bearer '.$admin->createToken('api')->plainTextToken,
    ]);
}

function managedIntern(User $mentor, string $name, array $profile = [], array $attributes = []): User
{
    return User::factory()->intern([
        'mentor_id' => $mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
        ...$profile,
    ])->create(['name' => $name, ...$attributes]);
}

it('returns an empty dashboard when nothing needs action', function () {
    adminDashboard($this->admin)
        ->assertOk()
        ->assertExactJson(['data' => [
            'date' => '2026-10-12',
            'airport_id' => null,
            'holiday' => null,
            'has_active_office' => false,
            'today' => ['interns' => 0, 'clocked_in' => 0, 'late' => 0, 'on_leave' => 0, 'not_clocked_in' => 0, 'rows' => []],
            'yesterday' => null,
            'pending_corrections' => ['total' => 0, 'items' => []],
            'overdue_leaves' => ['total' => 0, 'items' => []],
            'pending_presentations' => ['total' => 0, 'items' => []],
            'ending_internships' => ['total' => 0, 'items' => []],
            'quota_exhausted' => ['total' => 0, 'items' => []],
            'new_assessments' => ['total' => 0, 'items' => []],
            'campuses' => [],
        ]]);
});

it('tells the frontend whether an active office exists', function () {
    Office::factory()->inactive()->create();
    adminDashboard($this->admin)->assertJsonPath('data.has_active_office', false);

    Office::factory()->create();
    adminDashboard($this->admin)->assertJsonPath('data.has_active_office', true);
});

it('counts today for active interns in their internship period only', function () {

    $rina = managedIntern($this->mentor, 'Rina Wulandari');
    $budi = managedIntern($this->mentor, 'Budi Kurniawan');
    $andi = managedIntern($this->mentor, 'Andi Pratama');
    $dewi = managedIntern($this->mentor, 'Dewi Sartika');
    $doni = managedIntern($this->mentor, 'Doni Akbar');
    managedIntern($this->mentor, 'Eka Putri');
    $inactive = managedIntern($this->mentor, 'Nonaktif Satu', attributes: ['is_active' => false]);
    $notStarted = managedIntern($this->mentor, 'Belum Mulai', ['start_date' => '2026-10-13']);
    $ended = managedIntern($this->mentor, 'Sudah Selesai', ['end_date' => '2026-10-11']);

    Attendance::factory()->for($rina, 'intern')->clockedIn()->create(['clock_in_at' => '08:25:00']);
    Attendance::factory()->for($budi, 'intern')->create(['clock_in_at' => '07:55:00']);
    Attendance::factory()->for($andi, 'intern')->create(['clock_in_at' => '08:16:00']);
    Attendance::factory()->for($doni, 'intern')->create(['clock_in_at' => '08:15:00']);
    LeaveRequest::factory()->for($dewi, 'intern')->approved()->create(['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);
    foreach ([$inactive, $notStarted, $ended] as $outside) {
        Attendance::factory()->for($outside, 'intern')->create(['clock_in_at' => '09:00:00']);
    }

    adminDashboard($this->admin)
        ->assertOk()
        ->assertJsonPath('data.today.interns', 6)
        ->assertJsonPath('data.today.clocked_in', 4)
        ->assertJsonPath('data.today.late', 2)
        ->assertJsonPath('data.today.on_leave', 1)
        ->assertJsonPath('data.today.not_clocked_in', 1)
        ->assertJsonPath('data.today.rows.*.intern.name', ['Andi Pratama', 'Budi Kurniawan', 'Dewi Sartika', 'Doni Akbar', 'Eka Putri', 'Rina Wulandari'])
        ->assertJsonPath('data.today.rows.0', [
            'intern' => ['id' => $andi->id, 'name' => 'Andi Pratama', 'short_name' => 'Andi P.'],
            'status' => 'late',
            'clock_in_at' => '08:16',
            'late_minutes' => 16,
            'missed_clock_out' => false,
            'leave_type' => null,
        ])
        ->assertJsonPath('data.today.rows.2.status', 'leave')
        ->assertJsonPath('data.today.rows.2.leave_type', 'sick')
        ->assertJsonPath('data.today.rows.4.status', 'not_clocked_in');
});

it('counts an intern who clocked in on an approved leave day as clocked in', function () {
    $rina = managedIntern($this->mentor, 'Rina Wulandari');
    Attendance::factory()->for($rina, 'intern')->create();
    LeaveRequest::factory()->for($rina, 'intern')->approved()->create();

    adminDashboard($this->admin)
        ->assertJsonPath('data.today.clocked_in', 1)
        ->assertJsonPath('data.today.on_leave', 0)
        ->assertJsonPath('data.today.not_clocked_in', 0);
});

it('measures lateness against the start time copied into the attendance', function () {
    $rina = managedIntern($this->mentor, 'Rina Wulandari');
    Attendance::factory()->for($rina, 'intern')->create(['clock_in_at' => '10:00:00', 'scheduled_start' => '10:00:00']);

    adminDashboard($this->admin)
        ->assertJsonPath('data.today.clocked_in', 1)
        ->assertJsonPath('data.today.late', 0)
        ->assertJsonPath('data.today.rows.0.status', 'present');
});

it('hides the today card on weekends and holidays', function () {
    managedIntern($this->mentor, 'Rina Wulandari');

    $this->travelTo(Carbon::parse('2026-10-10 10:00:00'));
    adminDashboard($this->admin)
        ->assertJsonPath('data.holiday', ['name' => null])
        ->assertJsonPath('data.today', null);

    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));
    Holiday::factory()->create(['date' => '2026-10-12', 'name' => 'Cuti bersama']);
    adminDashboard($this->admin)
        ->assertJsonPath('data.holiday', ['name' => 'Cuti bersama'])
        ->assertJsonPath('data.today', null);
});

it('summarises the final statuses of the previous working day', function () {
    // Jumat 9 Okt libur, jadi "kemarin" untuk Senin 12 Okt adalah Kamis 8 Okt.
    Holiday::factory()->create(['date' => '2026-10-09', 'name' => 'Libur kantor']);

    $present = managedIntern($this->mentor, 'Hadir Satu');
    $late = managedIntern($this->mentor, 'Hadir Terlambat');
    $missed = managedIntern($this->mentor, 'Lupa Keluar');
    $leave = managedIntern($this->mentor, 'Izin Sakit');
    managedIntern($this->mentor, 'Tidak Datang');
    managedIntern($this->mentor, 'Mulai Hari Ini', ['start_date' => '2026-10-12']);
    managedIntern($this->mentor, 'Dinonaktifkan', attributes: ['is_active' => false]);
    $lastDay = managedIntern($this->mentor, 'Hari Terakhir', ['end_date' => '2026-10-08']);

    Attendance::factory()->for($present, 'intern')->create(['date' => '2026-10-08']);
    Attendance::factory()->for($late, 'intern')->create(['date' => '2026-10-08', 'clock_in_at' => '09:30:00']);
    Attendance::factory()->for($missed, 'intern')->clockedIn()->create(['date' => '2026-10-08']);
    Attendance::factory()->for($lastDay, 'intern')->create(['date' => '2026-10-08']);
    LeaveRequest::factory()->for($leave, 'intern')->approved()->create(['start_date' => '2026-10-07', 'end_date' => '2026-10-08']);

    adminDashboard($this->admin)
        ->assertOk()
        ->assertJson(['data' => ['yesterday' => [
            'date' => '2026-10-08',
            // Hadir Satu, Lupa Keluar (Hadir + Lupa Clock Out), dan Hari Terakhir.
            'present' => 3,
            'late' => 1,
            'missed_clock_in' => 0,
            'leave' => 1,
            'absent' => 1,
            'missed_clock_out' => 1,
        ]]])
        ->assertJsonCount(6, 'data.yesterday.rows');
});

it('lists leaves pending for more than 24 hours, oldest first, at most five', function () {
    $andi = managedIntern($this->mentor, 'Andi Pratama');

    $oldest = LeaveRequest::factory()->for($andi, 'intern')->create([
        'type' => LeaveType::Urgent, 'start_date' => '2026-10-13', 'end_date' => '2026-10-14', 'created_at' => '2026-10-11 08:39:00',
    ]);
    foreach (range(1, 5) as $hour) {
        LeaveRequest::factory()->for($andi, 'intern')->create(['created_at' => Carbon::parse('2026-10-11 09:00:00')->addHours($hour)]);
    }
    LeaveRequest::factory()->for($andi, 'intern')->create(['created_at' => '2026-10-11 14:39:00']);
    LeaveRequest::factory()->for($andi, 'intern')->approved()->create(['created_at' => '2026-10-01 09:00:00']);

    adminDashboard($this->admin)
        ->assertOk()
        ->assertJsonPath('data.overdue_leaves.total', 6)
        ->assertJsonCount(5, 'data.overdue_leaves.items')
        ->assertJsonPath('data.overdue_leaves.items.0', [
            'id' => $oldest->id,
            'intern' => ['id' => $andi->id, 'name' => 'Andi Pratama', 'short_name' => 'Andi P.'],
            'type' => 'urgent',
            'start_date' => '2026-10-13',
            'end_date' => '2026-10-14',
            'created_at' => '2026-10-11T08:39:00+07:00',
            'pending_hours' => 30,
        ]);
});

it('lists corrections approved by the mentor and waiting for the admin, oldest first', function () {
    $rina = managedIntern($this->mentor, 'Rina Wulandari');
    $budi = managedIntern($this->mentor, 'Budi Kurniawan');

    $newer = AttendanceCorrection::factory()->for($budi, 'intern')->pendingAdmin()->create(['date' => '2026-10-08', 'mentor_decided_at' => '2026-10-10 09:12:00']);
    $older = AttendanceCorrection::factory()->for($rina, 'intern')->pendingAdmin()->create(['date' => '2026-10-09', 'mentor_decided_at' => '2026-10-09 18:00:00', 'recorded_missed_clock_out' => true]);
    AttendanceCorrection::factory()->for($rina, 'intern')->create(['date' => '2026-10-05']);
    AttendanceCorrection::factory()->for($rina, 'intern')->decidedByAdmin(CorrectionStatus::RejectedByAdmin, $this->admin)->create(['date' => '2026-10-02']);

    adminDashboard($this->admin)
        ->assertOk()
        ->assertJsonPath('data.pending_corrections.total', 2)
        ->assertJsonPath('data.pending_corrections.items.0', [
            'id' => $older->id,
            'intern' => ['id' => $rina->id, 'name' => 'Rina Wulandari', 'short_name' => 'Rina W.'],
            'date' => '2026-10-09',
            'recorded_status' => $older->recorded_status->value,
            'recorded_missed_clock_out' => true,
            'mentor_decided_at' => '2026-10-09T18:00:00+07:00',
        ])
        ->assertJsonPath('data.pending_corrections.items.1.id', $newer->id);
});

it('lists active interns whose internship ends within seven days, nearest first', function () {
    $doni = managedIntern($this->mentor, 'Doni Akbar', ['end_date' => '2026-10-19']);
    $rina = managedIntern($this->mentor, 'Rina Wulandari', ['end_date' => '2026-10-12']);
    managedIntern($this->mentor, 'Delapan Hari', ['end_date' => '2026-10-20']);
    managedIntern($this->mentor, 'Sudah Selesai', ['end_date' => '2026-10-11']);
    managedIntern($this->mentor, 'Dinonaktifkan', ['end_date' => '2026-10-15'], ['is_active' => false]);
    managedIntern($this->mentor, 'Belum Mulai', ['start_date' => '2026-10-13', 'end_date' => '2026-10-16']);

    adminDashboard($this->admin)
        ->assertOk()
        ->assertJsonPath('data.ending_internships', [
            'total' => 2,
            'items' => [
                [
                    'intern' => ['id' => $rina->id, 'name' => 'Rina Wulandari', 'short_name' => 'Rina W.'],
                    'end_date' => '2026-10-12',
                    'ends_in_days' => 0,
                    'mentor' => ['id' => $this->mentor->id, 'name' => 'Sari Wijaya'],
                ],
                [
                    'intern' => ['id' => $doni->id, 'name' => 'Doni Akbar', 'short_name' => 'Doni A.'],
                    'end_date' => '2026-10-19',
                    'ends_in_days' => 7,
                    'mentor' => ['id' => $this->mentor->id, 'name' => 'Sari Wijaya'],
                ],
            ],
        ]);
});

it('leaves out requests of deleted interns', function () {
    $gone = managedIntern($this->mentor, 'Sudah Dihapus');
    LeaveRequest::factory()->for($gone, 'intern')->create(['created_at' => '2026-10-10 09:00:00']);
    AttendanceCorrection::factory()->for($gone, 'intern')->pendingAdmin()->create();
    $gone->delete();

    adminDashboard($this->admin)
        ->assertJsonPath('data.overdue_leaves.total', 0)
        ->assertJsonPath('data.pending_corrections.total', 0);
});

it('lists pending presentations, exhausted quotas, and newly submitted assessments', function () {
    $rina = managedIntern($this->mentor, 'Rina Wulandari');
    $budi = managedIntern($this->mentor, 'Budi Kurniawan');
    $presentation = FinalPresentation::factory()->create(['intern_id' => $rina->id, 'submitted_at' => '2026-10-11 10:00:00']);
    FinalPresentation::factory()->approved()->create(['intern_id' => $budi->id]);
    LeaveRequest::factory()->for($budi, 'intern')->count(3)->sequence(
        ['start_date' => '2026-09-14', 'end_date' => '2026-09-14'],
        ['start_date' => '2026-09-21', 'end_date' => '2026-09-21'],
        ['start_date' => '2026-09-28', 'end_date' => '2026-09-28'],
    )->approved()->create();
    Assessment::factory()->submitted('87.50')->create(['intern_id' => $budi->id, 'mentor_id' => $this->mentor->id, 'submitted_at' => '2026-10-10 15:00:00']);
    Assessment::factory()->submitted()->create(['submitted_at' => '2026-09-01 10:00:00']);

    adminDashboard($this->admin)
        ->assertJsonPath('data.pending_presentations', ['total' => 1, 'items' => [[
            'id' => $presentation->id,
            'intern' => ['id' => $rina->id, 'name' => 'Rina Wulandari', 'short_name' => 'Rina W.'],
            'evidence_url' => $presentation->evidence_url,
            'submitted_at' => '2026-10-11T10:00:00+07:00',
        ]]])
        ->assertJsonPath('data.quota_exhausted.total', 1)
        ->assertJsonPath('data.quota_exhausted.items.0.intern.id', $budi->id)
        ->assertJsonPath('data.quota_exhausted.items.0.quota', ['used' => 3, 'limit' => 3, 'remaining' => 0, 'exhausted' => true])
        ->assertJsonPath('data.new_assessments', ['total' => 1, 'items' => [[
            'intern' => ['id' => $budi->id, 'name' => 'Budi Kurniawan', 'short_name' => 'Budi K.'],
            'final_score' => 87.5,
            'assessed_by' => 'Sari Wijaya',
            'submitted_at' => '2026-10-10T15:00:00+07:00',
        ]]]);
});

it('counts active interns per university', function () {
    managedIntern($this->mentor, 'Rina', ['university' => 'Telkom University']);
    managedIntern($this->mentor, 'Budi', ['university' => 'Telkom University']);
    managedIntern($this->mentor, 'Andi', ['university' => 'Universitas Indonesia']);
    managedIntern($this->mentor, 'Selesai', ['university' => 'ITB', 'end_date' => '2026-10-01']);

    adminDashboard($this->admin)->assertJsonPath('data.campuses', [
        ['university' => 'Telkom University', 'total' => 2],
        ['university' => 'Universitas Indonesia', 'total' => 1],
    ]);
});

it('filters the whole dashboard by airport and follows that airport schedule', function () {
    $soetta = Airport::factory()->create();
    $halim = Airport::factory()->create();
    $rina = managedIntern($this->mentor, 'Rina Wulandari', ['airport_id' => $soetta->id]);
    $budi = managedIntern($this->mentor, 'Budi Kurniawan', ['airport_id' => $halim->id]);
    AttendanceCorrection::factory()->for($rina, 'intern')->pendingAdmin()->create(['date' => '2026-10-08']);
    AttendanceCorrection::factory()->for($budi, 'intern')->pendingAdmin()->create(['date' => '2026-10-08']);
    Office::factory()->for($halim)->create();

    adminDashboard($this->admin, "?airport_id={$soetta->id}")
        ->assertJsonPath('data.airport_id', $soetta->id)
        ->assertJsonPath('data.has_active_office', false)
        ->assertJsonPath('data.today.rows.*.intern.id', [$rina->id])
        ->assertJsonPath('data.pending_corrections.total', 1);

    AirportWeeklySchedule::query()->where('airport_id', $halim->id)->where('day_of_week', 1)->update(['is_workday' => false, 'start_time' => null, 'end_time' => null]);

    adminDashboard($this->admin, "?airport_id={$halim->id}")
        ->assertJsonPath('data.holiday', ['name' => null])
        ->assertJsonPath('data.today', null);
    adminDashboard($this->admin)
        ->assertJsonPath('data.holiday', null)
        ->assertJsonPath('data.today.rows.*.intern.id', [$rina->id]);
});

it('rejects interns and mentors from the admin dashboard', function (string $role) {
    adminDashboard(User::factory()->{$role}()->create())
        ->assertForbidden()
        ->assertJsonPath('message', 'Anda tidak memiliki akses.');
})->with(['intern', 'mentor']);

it('rejects the admin dashboard before the temporary password is changed', function () {
    adminDashboard(User::factory()->admin()->mustChangePassword()->create())
        ->assertForbidden()
        ->assertJsonPath('must_change_password', true);
});

it('rejects the admin dashboard without a token', function () {
    $this->getJson('/api/admin/dashboard')->assertUnauthorized();
});
