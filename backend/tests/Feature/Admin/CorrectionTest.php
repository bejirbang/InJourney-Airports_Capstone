<?php

use App\Enums\AttendanceStatus;
use App\Enums\CorrectionStatus;
use App\Enums\LogbookStatus;
use App\Models\AirportWeeklySchedule;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\AuditLog;
use App\Models\Holiday;
use App\Models\Logbook;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 09:00:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Admin Sinta']);
    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->nabila = User::factory()->intern(['mentor_id' => $this->mentor->id, 'start_date' => '2026-09-01', 'end_date' => '2026-12-31'])->create(['name' => 'Nabila Putri']);
});

function adminCorrections(User $user, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

function forwarded(User $intern, string $date, array $attributes = []): AttendanceCorrection
{
    return AttendanceCorrection::factory()->for($intern, 'intern')->pendingAdmin()->create(['date' => $date, ...$attributes]);
}

function approveCorrection(AttendanceCorrection $correction, ?string $note = 'Sesuai validasi mentor.'): TestResponse
{
    return adminCorrections(test()->admin, 'POST', "/api/admin/corrections/{$correction->id}/approve", ['note' => $note]);
}

describe('daftar dan detail', function () {
    it('lists requests waiting for the admin by mentor approval time, and the mentor tab read-only', function () {
        $later = forwarded($this->nabila, '2026-10-06', ['mentor_decided_at' => '2026-10-08 09:00:00']);
        $first = forwarded($this->nabila, '2026-10-01', ['mentor_decided_at' => '2026-10-07 09:00:00']);
        $waitingMentor = AttendanceCorrection::factory()->for($this->nabila, 'intern')->create(['date' => '2026-10-02']);

        adminCorrections($this->admin, 'GET', '/api/admin/corrections')
            ->assertOk()
            ->assertJsonPath('data.*.id', [$first->id, $later->id])
            ->assertJsonPath('data.0.can_decide', true)
            ->assertJsonPath('meta.pending_admin', 2)
            ->assertJsonPath('meta.pending_mentor', 1)
            ->assertJsonPath('meta.interns', [['id' => $this->nabila->id, 'name' => 'Nabila Putri']]);

        adminCorrections($this->admin, 'GET', '/api/admin/corrections?tab=pending_mentor')
            ->assertJsonPath('data.*.id', [$waitingMentor->id])
            ->assertJsonPath('data.0.can_decide', false);

        adminCorrections($this->admin, 'GET', '/api/admin/corrections?tab=all')->assertJsonCount(3, 'data');
    });

    it('shows the recorded data and the result if approved', function () {
        Attendance::factory()->for($this->nabila, 'intern')->clockedIn()->create(['date' => '2026-10-06', 'clock_in_at' => '08:00:00']);
        $correction = forwarded($this->nabila, '2026-10-06');

        adminCorrections($this->admin, 'GET', "/api/admin/corrections/{$correction->id}")
            ->assertOk()
            ->assertJsonPath('data.mentor_note', 'Benar, intern hadir.')
            ->assertJsonPath('data.recorded', ['clock_in_at' => '08:00', 'clock_out_at' => null])
            ->assertJsonPath('data.result', ['clock_in_at' => '08:00', 'clock_out_at' => '17:00']);
    });
});

describe('setujui', function () {
    it('fills the missing clock out with the scheduled end, marks the day corrected, and logs it', function () {
        $attendance = Attendance::factory()->for($this->nabila, 'intern')->clockedIn()->create(['date' => '2026-10-06', 'clock_in_at' => '08:20:00', 'scheduled_end' => '16:30:00']);
        Logbook::factory()->for($attendance)->create(['work' => 'Draft.']);
        $correction = forwarded($this->nabila, '2026-10-06', ['recorded_status' => AttendanceStatus::Late]);

        approveCorrection($correction)
            ->assertOk()
            ->assertJsonPath('message', 'Koreksi disetujui. Status hari itu menjadi Hadir.')
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.admin', ['id' => $this->admin->id, 'name' => 'Admin Sinta'])
            ->assertJsonPath('data.admin_note', 'Sesuai validasi mentor.')
            ->assertJsonPath('data.recorded', ['clock_in_at' => '08:20', 'clock_out_at' => '16:30']);

        expect($attendance->refresh()->only(['clock_in_at', 'clock_out_at', 'is_corrected', 'correction_id']))->toBe([
            'clock_in_at' => '08:20:00',
            'clock_out_at' => '16:30:00',
            'is_corrected' => true,
            'correction_id' => $correction->id,
        ])
            ->and(AuditLog::sole()->only(['admin_name', 'action', 'object', 'detail']))->toBe([
                'admin_name' => 'Admin Sinta',
                'action' => 'Koreksi Presensi',
                'object' => 'Nabila Putri',
                'detail' => 'Setujui koreksi 6 Okt: 08:20 - 16:30.',
            ]);

        // Hasil koreksi selalu Hadir, termasuk hari Terlambat; logbook draft kini bisa dikirim.
        $day = collect(adminCorrections($this->nabila, 'GET', '/api/intern/attendance')->json('data.days'))->firstWhere('date', '2026-10-06');
        expect($day)->toMatchArray(['status' => 'present', 'late_minutes' => null, 'missed_clock_out' => false, 'is_corrected' => true, 'logbook_state' => 'missing']);

        adminCorrections($this->nabila, 'PUT', '/api/intern/logbooks/2026-10-06', ['work' => 'Lengkap.'])->assertOk();
        expect($attendance->logbook?->refresh()->status)->toBe(LogbookStatus::PendingReview);
    });

    it('creates the attendance with the scheduled hours for an absent day', function () {
        AirportWeeklySchedule::factory()->create([
            'airport_id' => $this->nabila->internProfile->airport_id,
            'day_of_week' => 2,
            'start_time' => '07:30:00',
            'end_time' => '15:30:00',
            'effective_from' => '2026-10-01',
        ]);
        $correction = forwarded($this->nabila, '2026-10-06', ['recorded_status' => AttendanceStatus::Absent, 'recorded_missed_clock_out' => false]);

        approveCorrection($correction)->assertOk();

        expect(Attendance::sole()->only(['date', 'clock_in_at', 'clock_out_at', 'scheduled_start', 'scheduled_end', 'is_corrected', 'clock_in_office_id']))->toMatchArray([
            'clock_in_at' => '07:30:00',
            'clock_out_at' => '15:30:00',
            'scheduled_start' => '07:30:00',
            'scheduled_end' => '15:30:00',
            'is_corrected' => true,
            'clock_in_office_id' => null,
        ]);
    });

    it('fills the missing clock in and keeps the recorded clock out', function () {
        $attendance = Attendance::factory()->for($this->nabila, 'intern')->create(['date' => '2026-10-06', 'clock_in_at' => null, 'clock_out_at' => '17:20:00']);
        Logbook::factory()->pendingReview()->for($attendance)->create();

        approveCorrection(forwarded($this->nabila, '2026-10-06', ['recorded_status' => AttendanceStatus::MissedClockIn, 'recorded_missed_clock_out' => false]))->assertOk();

        expect($attendance->refresh()->only(['clock_in_at', 'clock_out_at']))->toBe(['clock_in_at' => '08:00:00', 'clock_out_at' => '17:20:00'])
            ->and($attendance->logbook?->status)->toBe(LogbookStatus::PendingReview);
    });

    it('notifies the intern and the mentor', function () {
        $correction = forwarded($this->nabila, '2026-10-06');

        approveCorrection($correction)->assertOk();

        expect(Notification::query()->orderBy('id')->get(['user_id', 'text', 'link_path'])->toArray())->toBe([
            ['user_id' => $this->nabila->id, 'text' => 'Koreksi presensi 6 Okt disetujui.', 'link_path' => '/presensi'],
            ['user_id' => $this->mentor->id, 'text' => 'Koreksi Nabila P. 6 Okt disetujui admin.', 'link_path' => '/koreksi'],
        ]);
    });

    it('requires a note', function () {
        $correction = forwarded($this->nabila, '2026-10-06');

        approveCorrection($correction, null)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['note' => 'Catatan wajib diisi.']);

        expect($correction->refresh()->status)->toBe(CorrectionStatus::PendingAdmin);
    });

    it('refuses a day that is no longer a working day', function () {
        Holiday::factory()->create(['date' => '2026-10-06']);
        $correction = forwarded($this->nabila, '2026-10-06', ['recorded_status' => AttendanceStatus::Absent]);

        approveCorrection($correction)
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'not_workday');

        expect(Attendance::count())->toBe(0)->and($correction->refresh()->status)->toBe(CorrectionStatus::PendingAdmin);
    });
});

describe('tolak dan konflik', function () {
    it('rejects with a note without touching the attendance', function () {
        $attendance = Attendance::factory()->for($this->nabila, 'intern')->clockedIn()->create(['date' => '2026-10-06']);
        $correction = forwarded($this->nabila, '2026-10-06');

        adminCorrections($this->admin, 'POST', "/api/admin/corrections/{$correction->id}/reject", ['note' => 'Sudah dikoreksi di tanggal lain.'])
            ->assertOk()
            ->assertJsonPath('message', 'Koreksi ditolak. Data presensi tidak berubah.')
            ->assertJsonPath('data.status', 'rejected_by_admin');

        expect($attendance->refresh()->is_corrected)->toBeFalse()
            ->and(AuditLog::sole()->detail)->toBe('Tolak koreksi 6 Okt.')
            ->and(Notification::query()->pluck('text')->all())->toBe(['Koreksi presensi 6 Okt ditolak.', 'Koreksi Nabila P. 6 Okt ditolak admin.']);
    });

    it('cannot process a request still waiting for the mentor', function () {
        $correction = AttendanceCorrection::factory()->for($this->nabila, 'intern')->create();

        approveCorrection($correction)
            ->assertUnprocessable()
            ->assertExactJson(['message' => 'Koreksi ini masih menunggu mentor.', 'reason' => 'pending_mentor']);
    });

    it('tells the second admin who already decided, and refuses cancelled requests', function () {
        $correction = forwarded($this->nabila, '2026-10-06');
        approveCorrection($correction)->assertOk();

        $other = User::factory()->admin()->create();
        adminCorrections($other, 'POST', "/api/admin/corrections/{$correction->id}/reject", ['note' => 'Tolak.'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Data ini sudah diproses oleh Admin Sinta.');

        $cancelled = forwarded($this->nabila, '2026-10-07', ['status' => CorrectionStatus::Cancelled]);
        approveCorrection($cancelled)->assertJsonPath('reason', 'cancelled');

        expect(AuditLog::count())->toBe(1);
    });
});

it('rejects interns and mentors', function (string $role) {
    $actor = User::factory()->{$role}()->create();
    $correction = forwarded($this->nabila, '2026-10-06');

    adminCorrections($actor, 'GET', '/api/admin/corrections')->assertForbidden();
    adminCorrections($actor, 'POST', "/api/admin/corrections/{$correction->id}/approve", ['note' => 'Oke.'])->assertForbidden();
})->with(['intern', 'mentor']);
