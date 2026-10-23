<?php

use App\Enums\LeaveType;
use App\Enums\RequestStatus;
use App\Enums\TaskStatus;
use App\Models\Attendance;
use App\Models\DailyReport;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\MentorHistory;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkHourSetting;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
});

function asMentor(User $mentor, string $uri): TestResponse
{
    return test()->getJson($uri, ['Authorization' => 'Bearer '.$mentor->createToken('api')->plainTextToken]);
}

function internOf(User $mentor, string $name, array $profile = [], array $attributes = []): User
{
    return User::factory()->intern([
        'mentor_id' => $mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
        ...$profile,
    ])->create(['name' => $name, 'title' => 'Backend Intern', ...$attributes]);
}

function formerInternOf(User $former, string $name): User
{
    $current = User::factory()->mentor()->create(['name' => 'Budi Santoso']);
    $intern = internOf($current, $name);

    MentorHistory::query()->create(['intern_id' => $intern->id, 'mentor_id' => $former->id, 'started_at' => '2026-09-01', 'ended_at' => '2026-10-01']);
    MentorHistory::query()->create(['intern_id' => $intern->id, 'mentor_id' => $current->id, 'started_at' => '2026-10-01']);

    return $intern;
}

function attendOn(User $intern, string $date, string $in = '08:15:00', ?string $out = '17:00:00', bool $corrected = false): Attendance
{
    return Attendance::factory()->for($intern, 'intern')->create([
        'date' => $date, 'clock_in_at' => $in, 'clock_out_at' => $out, 'is_corrected' => $corrected,
    ]);
}

describe('daftar Intern Saya', function () {
    it('lists active interns by default with today state and period', function () {
        $andi = internOf($this->mentor, 'Andi Pratama');
        internOf($this->mentor, 'Nonaktif', attributes: ['is_active' => false]);
        User::factory()->intern()->create(['name' => 'Bukan bimbingan']);
        attendOn($andi, '2026-10-12', out: null);

        asMentor($this->mentor, '/api/mentor/interns')
            ->assertOk()
            ->assertJsonPath('meta', ['current_total' => 2, 'former_total' => 0])
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0', [
                'id' => $andi->id,
                'name' => 'Andi Pratama',
                'title' => 'Backend Intern',
                'photo_url' => null,
                'start_date' => '2026-09-01',
                'end_date' => '2026-12-31',
                'is_active' => true,
                'relation' => 'current',
                'ends_in_days' => null,
                'today_state' => 'clocked_in',
            ]);
    });

    it('filters inactive interns, including those not started yet or already ended', function () {
        internOf($this->mentor, 'Andi Pratama');
        internOf($this->mentor, 'Dinonaktifkan', attributes: ['is_active' => false]);
        internOf($this->mentor, 'Belum Mulai', ['start_date' => '2026-10-13']);
        internOf($this->mentor, 'Sudah Selesai', ['end_date' => '2026-10-11']);

        $response = asMentor($this->mentor, '/api/mentor/interns?status=inactive')->assertOk();

        expect(collect($response->json('data'))->pluck('name')->all())->toBe(['Belum Mulai', 'Dinonaktifkan', 'Sudah Selesai'])
            ->and(collect($response->json('data'))->pluck('today_state')->unique()->all())->toBe([null])
            ->and(collect($response->json('data'))->pluck('is_active')->unique()->all())->toBe([false]);
    });

    it('lists all current interns with status=all', function () {
        internOf($this->mentor, 'Andi Pratama');
        internOf($this->mentor, 'Nonaktif', attributes: ['is_active' => false]);
        formerInternOf($this->mentor, 'Rina Wulandari');

        asMentor($this->mentor, '/api/mentor/interns?status=all')->assertOk()->assertJsonCount(2, 'data');
    });

    it('lists interns this mentor used to mentor under former', function () {
        $rina = formerInternOf($this->mentor, 'Rina Wulandari');
        internOf($this->mentor, 'Andi Pratama');

        asMentor($this->mentor, '/api/mentor/interns?status=former')
            ->assertOk()
            ->assertJsonPath('meta', ['current_total' => 1, 'former_total' => 1])
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $rina->id)
            ->assertJsonPath('data.0.relation', 'former')
            ->assertJsonPath('data.0.today_state', null);
    });

    it('marks interns whose internship ends within 7 days', function () {
        internOf($this->mentor, 'Rina Wulandari', ['end_date' => '2026-10-19']);
        internOf($this->mentor, 'Hari Terakhir', ['end_date' => '2026-10-12']);
        internOf($this->mentor, 'Masih Lama', ['end_date' => '2026-10-20']);

        $days = collect(asMentor($this->mentor, '/api/mentor/interns')->assertOk()->json('data'))->pluck('ends_in_days', 'name');

        expect($days->all())->toBe(['Hari Terakhir' => 0, 'Masih Lama' => null, 'Rina Wulandari' => 7]);
    });

    it('searches by name, case insensitive', function () {
        internOf($this->mentor, 'Andi Pratama');
        internOf($this->mentor, 'Rina Wulandari');

        asMentor($this->mentor, '/api/mentor/interns?q=wULAN')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Rina Wulandari');
    });

    it('rejects an unknown filter', function () {
        asMentor($this->mentor, '/api/mentor/interns?status=semua')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status' => 'Filter intern tidak valid.']);
    });
});

describe('detail intern', function () {
    it('shows the intern header for the current mentor', function () {
        $andi = internOf($this->mentor, 'Andi Pratama', attributes: ['email' => 'andi@injourney.test', 'phone' => '0812-1111-2222']);

        asMentor($this->mentor, "/api/mentor/interns/{$andi->id}")
            ->assertOk()
            ->assertJsonPath('data.name', 'Andi Pratama')
            ->assertJsonPath('data.email', 'andi@injourney.test')
            ->assertJsonPath('data.phone', '0812-1111-2222')
            ->assertJsonPath('data.relation', 'current')
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.current_mentor', ['id' => $this->mentor->id, 'name' => 'Sari Wijaya'])
            ->assertJsonPath('data.selectable_months', ['first' => '2026-09', 'last' => '2026-10']);
    });

    it('shows a former intern read-only with the new mentor name', function () {
        $rina = formerInternOf($this->mentor, 'Rina Wulandari');

        asMentor($this->mentor, "/api/mentor/interns/{$rina->id}")
            ->assertOk()
            ->assertJsonPath('data.relation', 'former')
            ->assertJsonPath('data.current_mentor.name', 'Budi Santoso');
    });

    it('still shows an inactive intern', function () {
        $intern = internOf($this->mentor, 'Nonaktif', attributes: ['is_active' => false]);

        asMentor($this->mentor, "/api/mentor/interns/{$intern->id}")->assertOk()->assertJsonPath('data.is_active', false);
    });

    it('rejects interns of other mentors and non-intern accounts on every tab', function (string $suffix) {
        $other = User::factory()->intern()->create();
        $admin = User::factory()->admin()->create();

        asMentor($this->mentor, "/api/mentor/interns/{$other->id}{$suffix}")
            ->assertForbidden()
            ->assertJsonPath('message', 'Anda tidak memiliki akses ke intern ini.');
        asMentor($this->mentor, "/api/mentor/interns/{$admin->id}{$suffix}")->assertForbidden();
    })->with(['', '/attendance', '/attendance/days/2026-10-09', '/daily-reports', '/tasks', '/leaves']);

    it('rejects interns and admins from Intern Saya', function (string $role) {
        asMentor(User::factory()->{$role}()->create(), '/api/mentor/interns')
            ->assertForbidden()
            ->assertJsonPath('message', 'Anda tidak memiliki akses.');
    })->with(['intern', 'admin']);
});

describe('tab Rekap Absensi', function () {
    beforeEach(function () {
        WorkHourSetting::factory()->create(['start_time' => '08:00:00', 'end_time' => '17:00:00', 'effective_from' => '2026-01-01']);
        $this->andi = internOf($this->mentor, 'Andi Pratama');
    });

    it('shows the monthly recap and daily rows without the late mark', function () {
        attendOn($this->andi, '2026-10-09', '08:02:00', corrected: true);
        attendOn($this->andi, '2026-10-08', '08:10:00', '17:05:00');
        LeaveRequest::factory()->for($this->andi, 'intern')->approved()->create([
            'type' => LeaveType::Sick, 'start_date' => '2026-10-07', 'end_date' => '2026-10-07',
        ]);
        attendOn($this->andi, '2026-10-06', '08:00:00', null);

        $response = asMentor($this->mentor, "/api/mentor/interns/{$this->andi->id}/attendance?month=2026-10")
            ->assertOk()
            ->assertJsonPath('data.month', '2026-10')
            ->assertJsonPath('data.selectable_months', ['first' => '2026-09', 'last' => '2026-10'])
            ->assertJsonPath('data.recap', [
                'month' => '2026-10',
                'present' => 2,
                'leave' => 1,
                'absent' => 3,
                'missed_clock_out' => 1,
                'working_days' => 7,
            ]);

        $days = collect($response->json('data.days'))->keyBy('date');

        expect($days->keys()->first())->toBe('2026-10-12')
            ->and($days['2026-10-12']['status'])->toBe('not_clocked_in')
            ->and($days['2026-10-09'])->toBe([
                'date' => '2026-10-09',
                'status' => 'present',
                'clock_in_at' => '08:02',
                'clock_out_at' => '17:00',
                'is_corrected' => true,
                'daily_report_sent' => false,
                'holiday_name' => null,
                'leave_type' => null,
            ])
            ->and($days['2026-10-07']['leave_type'])->toBe('sick')
            ->and($days['2026-10-06']['status'])->toBe('missed_clock_out')
            ->and($days['2026-10-04']['status'])->toBe('holiday');

        expect($response->json('data.days.0'))->not->toHaveKeys(['late_minutes', 'has_pending_correction', 'can_request_correction']);
    });

    it('defaults to the current month and rejects months outside the internship', function () {
        asMentor($this->mentor, "/api/mentor/interns/{$this->andi->id}/attendance")
            ->assertOk()
            ->assertJsonPath('data.month', '2026-10');

        asMentor($this->mentor, "/api/mentor/interns/{$this->andi->id}/attendance?month=2026-08")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['month' => 'Bulan di luar periode magang.']);

        asMentor($this->mentor, "/api/mentor/interns/{$this->andi->id}/attendance?month=2026-11")->assertUnprocessable();
    });

    it('opens one day with the full daily report and offices, without the late mark', function () {
        $attendance = attendOn($this->andi, '2026-10-09', '08:20:00');
        DailyReport::factory()->for($attendance)->create(['work' => 'Menyelesaikan ERD tahap 1.', 'notes' => null, 'sent_at' => '2026-10-09 16:50:00']);

        asMentor($this->mentor, "/api/mentor/interns/{$this->andi->id}/attendance/days/2026-10-09")
            ->assertOk()
            ->assertJsonPath('data.status', 'present')
            ->assertJsonPath('data.clock_in_at', '08:20')
            ->assertJsonPath('data.daily_report', ['work' => 'Menyelesaikan ERD tahap 1.', 'notes' => null, 'sent_at' => '2026-10-09T16:50:00+07:00'])
            ->assertJsonMissingPath('data.late_minutes');
    });

    it('lets a former mentor read the attendance', function () {
        $rina = formerInternOf($this->mentor, 'Rina Wulandari');

        asMentor($this->mentor, "/api/mentor/interns/{$rina->id}/attendance")->assertOk();
    });
});

describe('tab Daily Report', function () {
    it('lists one row per working day with the report, newest first', function () {
        $andi = internOf($this->mentor, 'Andi Pratama');
        $sent = attendOn($andi, '2026-10-09');
        DailyReport::factory()->for($sent)->create(['work' => 'Rapat dengan tim.', 'notes' => 'Lanjut besok.', 'sent_at' => '2026-10-09 16:30:00']);
        attendOn($andi, '2026-10-08', out: null);
        LeaveRequest::factory()->for($andi, 'intern')->approved()->create(['type' => LeaveType::Urgent, 'start_date' => '2026-10-07', 'end_date' => '2026-10-07']);
        Holiday::factory()->create(['date' => '2026-10-05', 'name' => 'Libur Daerah']);

        $response = asMentor($this->mentor, "/api/mentor/interns/{$andi->id}/daily-reports?month=2026-10")
            ->assertOk()
            ->assertJsonPath('data.month', '2026-10');

        $days = collect($response->json('data.days'))->keyBy('date');

        expect($days->keys()->all())->toBe(['2026-10-12', '2026-10-09', '2026-10-08', '2026-10-07', '2026-10-06', '2026-10-02', '2026-10-01'])
            ->and($days['2026-10-09'])->toBe([
                'date' => '2026-10-09',
                'status' => 'present',
                'leave_type' => null,
                'report' => ['work' => 'Rapat dengan tim.', 'notes' => 'Lanjut besok.', 'sent_at' => '2026-10-09T16:30:00+07:00'],
                'report_missing' => false,
            ])
            ->and($days['2026-10-08']['report_missing'])->toBeTrue()
            ->and($days['2026-10-07']['leave_type'])->toBe('urgent')
            ->and($days['2026-10-07']['report_missing'])->toBeFalse()
            ->and($days['2026-10-06']['status'])->toBe('absent')
            ->and($days['2026-10-06']['report_missing'])->toBeFalse();
    });
});

describe('tab Task dan Izin', function () {
    it('lists all tasks of a current intern with the late mark', function () {
        $andi = internOf($this->mentor, 'Andi Pratama');
        $late = Task::factory()->create(['intern_id' => $andi->id, 'mentor_id' => $this->mentor->id, 'title' => 'Uji login', 'due_at' => '2026-10-10 17:00:00']);
        $byOldMentor = Task::factory()->status(TaskStatus::Done)->create(['intern_id' => $andi->id, 'due_at' => '2026-09-15 17:00:00']);

        asMentor($this->mentor, "/api/mentor/interns/{$andi->id}/tasks")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0', [
                'id' => $late->id,
                'code' => $late->code,
                'title' => 'Uji login',
                'status' => 'todo',
                'due_at' => '2026-10-10T17:00:00+07:00',
                'is_late' => true,
                'can_open' => true,
            ])
            ->assertJsonPath('data.1.id', $byOldMentor->id);
    });

    it('shows a former mentor only the tasks they created, without opening them', function () {
        $rina = formerInternOf($this->mentor, 'Rina Wulandari');
        $mine = Task::factory()->status(TaskStatus::Done)->create(['intern_id' => $rina->id, 'mentor_id' => $this->mentor->id]);
        Task::factory()->create(['intern_id' => $rina->id, 'mentor_id' => $rina->internProfile->mentor_id]);

        asMentor($this->mentor, "/api/mentor/interns/{$rina->id}/tasks")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $mine->id)
            ->assertJsonPath('data.0.can_open', false);
    });

    it('lists the leave history, newest submission first, with who decided', function () {
        $andi = internOf($this->mentor, 'Andi Pratama');
        $admin = User::factory()->admin()->create(['name' => 'Admin Sinta']);
        $old = LeaveRequest::factory()->for($andi, 'intern')->create([
            'type' => LeaveType::Sick, 'start_date' => '2026-10-01', 'end_date' => '2026-10-02',
            'status' => RequestStatus::Approved, 'decided_by' => $admin->id, 'created_at' => '2026-09-30 08:00:00',
        ]);
        $new = LeaveRequest::factory()->for($andi, 'intern')->create([
            'start_date' => '2026-10-13', 'end_date' => '2026-10-13', 'evidence_path' => 'leaves/1/surat.pdf', 'created_at' => '2026-10-12 08:00:00',
        ]);

        asMentor($this->mentor, "/api/mentor/interns/{$andi->id}/leaves")
            ->assertOk()
            ->assertJsonPath('data.0.id', $new->id)
            ->assertJsonPath('data.0.status', 'pending')
            ->assertJsonPath('data.0.has_evidence', true)
            ->assertJsonPath('data.0.decided_by', null)
            ->assertJsonPath('data.0.can_open', true)
            ->assertJsonPath('data.1', [
                'id' => $old->id,
                'type' => 'sick',
                'start_date' => '2026-10-01',
                'end_date' => '2026-10-02',
                'working_days' => 2,
                'status' => 'approved',
                'has_evidence' => false,
                'submitted_at' => '2026-09-30T08:00:00+07:00',
                'decided_by' => ['name' => 'Admin Sinta', 'role' => 'admin'],
                'can_open' => true,
            ]);
    });

    it('does not let a former mentor open leaves', function () {
        $rina = formerInternOf($this->mentor, 'Rina Wulandari');
        LeaveRequest::factory()->for($rina, 'intern')->create();

        asMentor($this->mentor, "/api/mentor/interns/{$rina->id}/leaves")
            ->assertOk()
            ->assertJsonPath('data.0.can_open', false);
    });
});
