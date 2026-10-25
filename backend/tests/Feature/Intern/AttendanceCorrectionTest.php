<?php

use App\Enums\AttendanceStatus;
use App\Enums\CorrectionStatus;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 09:00:00'));

    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->intern = User::factory()->intern([
        'mentor_id' => $this->mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create(['name' => 'Nabila Putri']);
    $this->token = $this->intern->createToken('api')->plainTextToken;
});

function correctionRequest(string $method, string $uri, array $data = []): TestResponse
{
    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.test()->token]);
}

function submitCorrection(array $overrides = []): TestResponse
{
    return correctionRequest('POST', '/api/intern/attendance-corrections', [
        'date' => '2026-10-06',
        'reason' => 'Baterai HP habis saat akan clock out.',
        ...$overrides,
    ]);
}

describe('ajukan koreksi', function () {
    it('submits a missed clock out day to the mentor with the recorded condition', function () {
        Attendance::factory()->for($this->intern, 'intern')->clockedIn()->create(['date' => '2026-10-06', 'clock_in_at' => '08:00:00']);

        submitCorrection()
            ->assertCreated()
            ->assertJsonPath('message', 'Pengajuan koreksi terkirim. Menunggu mentor.')
            ->assertJsonPath('data.date', '2026-10-06')
            ->assertJsonPath('data.recorded_status', 'present')
            ->assertJsonPath('data.recorded_missed_clock_out', true)
            ->assertJsonPath('data.status', 'pending_mentor')
            ->assertJsonPath('data.mentor', ['id' => $this->mentor->id, 'name' => 'Sari Wijaya'])
            ->assertJsonPath('data.recorded', ['clock_in_at' => '08:00', 'clock_out_at' => null])
            ->assertJsonPath('data.can_cancel', true)
            ->assertJsonPath('data.can_decide', false);

        $correction = AttendanceCorrection::sole();
        expect($correction->mentor_id)->toBe($this->mentor->id)
            ->and(Notification::sole()->only(['user_id', 'text', 'link_path', 'link_params']))->toBe([
                'user_id' => $this->mentor->id,
                'text' => 'Nabila P. mengajukan koreksi presensi 6 Okt.',
                'link_path' => '/koreksi',
                'link_params' => ['open' => $correction->id],
            ]);
    });

    it('accepts late, missed clock in, and absent days', function (array $attendance, string $status) {
        if ($attendance !== []) {
            Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-06', ...$attendance]);
        }

        submitCorrection()->assertCreated()->assertJsonPath('data.recorded_status', $status)->assertJsonPath('data.recorded_missed_clock_out', false);
    })->with([
        'terlambat' => [['clock_in_at' => '08:40:00'], 'late'],
        'lupa clock in' => [['clock_in_at' => null], 'missed_clock_in'],
        'tidak hadir' => [[], 'absent'],
    ]);

    it('rejects days that do not need correction', function (Closure $setup, string $message) {
        $setup($this);

        submitCorrection()
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date' => $message]);

        expect(AttendanceCorrection::count())->toBe(0);
    })->with([
        'hadir tepat waktu' => [fn ($t) => Attendance::factory()->for($t->intern, 'intern')->create(['date' => '2026-10-06']), 'Presensi tanggal ini tidak perlu dikoreksi.'],
        'sudah dikoreksi' => [fn ($t) => Attendance::factory()->for($t->intern, 'intern')->create(['date' => '2026-10-06', 'clock_in_at' => '09:00:00', 'is_corrected' => true]), 'Presensi tanggal ini tidak perlu dikoreksi.'],
        'izin' => [fn ($t) => LeaveRequest::factory()->for($t->intern, 'intern')->approved()->create(['start_date' => '2026-10-06', 'end_date' => '2026-10-06']), 'Presensi tanggal ini tidak perlu dikoreksi.'],
        'libur' => [fn ($t) => Holiday::factory()->create(['date' => '2026-10-06']), 'Pilih hari kerja yang sudah lewat, dalam periode magang.'],
    ]);

    it('rejects today, the future, weekends, and dates outside the internship', function (string $date) {
        submitCorrection(['date' => $date])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date' => 'Pilih hari kerja yang sudah lewat, dalam periode magang.']);
    })->with(['2026-10-12', '2026-10-13', '2026-10-10', '2026-08-31']);

    it('allows only one active request per date', function () {
        submitCorrection()->assertCreated();

        submitCorrection()
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date' => 'Sudah ada pengajuan koreksi untuk tanggal ini.']);

        AttendanceCorrection::query()->update(['status' => CorrectionStatus::PendingAdmin]);
        submitCorrection()->assertJsonValidationErrors(['date' => 'Sudah ada pengajuan koreksi untuk tanggal ini.']);

        AttendanceCorrection::query()->update(['status' => CorrectionStatus::RejectedByMentor]);
        submitCorrection()->assertCreated();
    });

    it('validates the form', function (array $input, string $field, string $message) {
        submitCorrection($input)->assertUnprocessable()->assertJsonValidationErrors([$field => $message]);
    })->with([
        'tanpa alasan' => [['reason' => '  '], 'reason', 'Alasan wajib diisi.'],
        'tanpa tanggal' => [['date' => null], 'date', 'Pilih tanggal yang akan dikoreksi.'],
        'tanggal salah' => [['date' => '06-10-2026'], 'date', 'Pilih tanggal yang akan dikoreksi.'],
    ]);

    it('marks the history row once a request is active', function () {
        submitCorrection()->assertCreated();

        $day = collect(correctionRequest('GET', '/api/intern/attendance')->json('data.days'))->firstWhere('date', '2026-10-06');

        expect($day)->toMatchArray(['has_active_correction' => true, 'can_request_correction' => false]);
    });
});

describe('daftar dan batal', function () {
    it('lists the intern’s own requests newest first', function () {
        $old = AttendanceCorrection::factory()->for($this->intern, 'intern')->rejectedByMentor('Tidak sesuai.')->create(['date' => '2026-10-01', 'created_at' => '2026-10-02 08:00:00']);
        $new = AttendanceCorrection::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-06', 'created_at' => '2026-10-07 08:00:00']);
        AttendanceCorrection::factory()->create();

        correctionRequest('GET', '/api/intern/attendance-corrections')
            ->assertOk()
            ->assertJsonPath('data.*.id', [$new->id, $old->id])
            ->assertJsonPath('data.1.mentor_note', 'Tidak sesuai.')
            ->assertJsonPath('data.1.can_cancel', false);
    });

    it('cancels while waiting for the mentor or the admin', function (bool $forwarded) {
        $factory = AttendanceCorrection::factory()->for($this->intern, 'intern');
        $correction = ($forwarded ? $factory->pendingAdmin() : $factory)->create();

        correctionRequest('POST', "/api/intern/attendance-corrections/{$correction->id}/cancel")
            ->assertOk()
            ->assertJsonPath('message', 'Pengajuan koreksi dibatalkan.')
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.can_cancel', false);
    })->with(['menunggu mentor' => [false], 'menunggu admin' => [true]]);

    it('cannot cancel a decided or cancelled request', function () {
        $admin = User::factory()->admin()->create(['name' => 'Admin Sinta']);
        $approved = AttendanceCorrection::factory()->for($this->intern, 'intern')->decidedByAdmin(CorrectionStatus::Approved, $admin)->create();
        $rejected = AttendanceCorrection::factory()->for($this->intern, 'intern')->rejectedByMentor()->create(['date' => '2026-10-07']);
        $cancelled = AttendanceCorrection::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-08', 'status' => CorrectionStatus::Cancelled]);

        correctionRequest('POST', "/api/intern/attendance-corrections/{$approved->id}/cancel")
            ->assertUnprocessable()
            ->assertExactJson(['message' => 'Data ini sudah diproses oleh Admin Sinta.', 'reason' => 'already_processed']);
        correctionRequest('POST', "/api/intern/attendance-corrections/{$rejected->id}/cancel")
            ->assertJsonPath('message', 'Data ini sudah diproses oleh Sari Wijaya.');
        correctionRequest('POST', "/api/intern/attendance-corrections/{$cancelled->id}/cancel")
            ->assertJsonPath('reason', 'already_cancelled');
    });

    it('hides other interns’ requests', function () {
        $other = AttendanceCorrection::factory()->create();

        correctionRequest('GET', "/api/intern/attendance-corrections/{$other->id}")->assertForbidden();
        correctionRequest('POST', "/api/intern/attendance-corrections/{$other->id}/cancel")->assertForbidden();

        expect($other->refresh()->status)->toBe(CorrectionStatus::PendingMentor);
    });
});

it('rejects mentors and admins', function (string $role) {
    $user = User::factory()->{$role}()->create();

    test()->getJson('/api/intern/attendance-corrections', ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken])->assertForbidden();
})->with(['mentor', 'admin']);

it('keeps the recorded status even if the day changes later', function () {
    Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-06', 'clock_in_at' => '08:40:00']);
    submitCorrection()->assertCreated();

    expect(AttendanceCorrection::sole()->recorded_status)->toBe(AttendanceStatus::Late);
});
