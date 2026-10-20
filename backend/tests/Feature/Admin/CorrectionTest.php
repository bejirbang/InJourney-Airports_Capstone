<?php

use App\Enums\RequestStatus;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\Office;
use App\Models\User;
use App\Models\WorkHourSetting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

// Senin, 12 Oktober 2026 pukul 14:39.
beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));
    Storage::fake();
    WorkHourSetting::factory()->create();

    $this->admin = User::factory()->admin()->create(['name' => 'Admin Sinta']);
    $this->rina = User::factory()->intern(['start_date' => '2026-09-01', 'end_date' => '2026-12-31'])->create(['name' => 'Rina Wulandari']);
    $this->budi = User::factory()->intern(['start_date' => '2026-09-01', 'end_date' => '2026-12-31'])->create(['name' => 'Budi Kurniawan']);

    // Jum 9 Okt: Rina lupa clock out.
    $this->office = Office::factory()->create();
    $this->attendance = Attendance::factory()->for($this->rina, 'intern')->clockedIn()->create([
        'date' => '2026-10-09', 'clock_in_at' => '08:02:00', 'clock_in_office_id' => $this->office->id,
    ]);
    $this->correction = AttendanceCorrection::factory()->for($this->rina, 'intern')->create([
        'date' => '2026-10-09',
        'recorded_clock_in' => '08:02:00',
        'recorded_clock_out' => null,
        'requested_clock_in' => '08:02:00',
        'requested_clock_out' => '17:00:00',
        'reason' => 'Lupa clock out karena listrik padam.',
        'created_at' => '2026-10-10 09:12:00',
    ]);
});

function asAdminUser(User $user, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

describe('daftar', function () {
    it('shows pending requests by default, oldest first, with intern choices', function () {
        $newer = AttendanceCorrection::factory()->for($this->budi, 'intern')->create(['date' => '2026-10-08', 'created_at' => '2026-10-11 14:30:00']);
        AttendanceCorrection::factory()->for($this->budi, 'intern')->decided(RequestStatus::Approved, $this->admin)->create(['date' => '2026-10-02']);

        asAdminUser($this->admin, 'GET', '/api/admin/corrections')
            ->assertOk()
            ->assertJsonPath('data.*.id', [$this->correction->id, $newer->id])
            ->assertJsonPath('data.0', [
                'id' => $this->correction->id,
                'intern' => ['id' => $this->rina->id, 'name' => 'Rina Wulandari', 'short_name' => 'Rina W.'],
                'date' => '2026-10-09',
                'submitted_at' => '2026-10-10T09:12:00+07:00',
                'status' => 'pending',
            ])
            ->assertJsonPath('meta.interns', [
                ['id' => $this->budi->id, 'name' => 'Budi Kurniawan'],
                ['id' => $this->rina->id, 'name' => 'Rina Wulandari'],
            ]);
    });

    it('filters by status, intern, and attendance date range', function () {
        $approved = AttendanceCorrection::factory()->for($this->budi, 'intern')->decided(RequestStatus::Approved, $this->admin)
            ->create(['date' => '2026-10-02', 'created_at' => '2026-10-03 08:05:00']);
        $cancelled = AttendanceCorrection::factory()->for($this->budi, 'intern')->create(['date' => '2026-10-05', 'status' => RequestStatus::Cancelled, 'created_at' => '2026-10-06 08:00:00']);

        asAdminUser($this->admin, 'GET', '/api/admin/corrections?status=approved')->assertJsonPath('data.*.id', [$approved->id]);
        asAdminUser($this->admin, 'GET', '/api/admin/corrections?status=all')->assertJsonPath('data.*.id', [$this->correction->id, $cancelled->id, $approved->id]);
        asAdminUser($this->admin, 'GET', "/api/admin/corrections?status=all&intern_id={$this->budi->id}")->assertJsonPath('data.*.id', [$cancelled->id, $approved->id]);
        asAdminUser($this->admin, 'GET', '/api/admin/corrections?status=all&from=2026-10-03&to=2026-10-09')->assertJsonPath('data.*.id', [$this->correction->id, $cancelled->id]);
    });

    it('rejects an unknown filter', function () {
        asAdminUser($this->admin, 'GET', '/api/admin/corrections?status=open')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status' => 'Filter koreksi tidak valid.']);
    });
});

describe('detail', function () {
    it('shows recorded and requested data with the current day status', function () {
        asAdminUser($this->admin, 'GET', "/api/admin/corrections/{$this->correction->id}")
            ->assertOk()
            ->assertJsonPath('data.recorded', ['clock_in' => '08:02', 'clock_out' => null, 'status' => 'missed_clock_out'])
            ->assertJsonPath('data.requested', ['clock_in' => '08:02', 'clock_out' => '17:00'])
            ->assertJsonPath('data.reason', 'Lupa clock out karena listrik padam.')
            ->assertJsonPath('data.has_evidence', false)
            ->assertJsonPath('data.final', null)
            ->assertJsonPath('data.can_decide', true);
    });

    it('streams the evidence for preview or download', function () {
        Storage::put('attendance-corrections/bukti.pdf', 'isi');
        $this->correction->update(['evidence_path' => 'attendance-corrections/bukti.pdf']);

        asAdminUser($this->admin, 'GET', "/api/admin/corrections/{$this->correction->id}/evidence")
            ->assertOk()
            ->assertDownload('bukti-koreksi-2026-10-09.pdf');

        $this->correction->update(['evidence_path' => null]);
        asAdminUser($this->admin, 'GET', "/api/admin/corrections/{$this->correction->id}/evidence")->assertNotFound();
    });
});

describe('setujui', function () {
    it('updates the attendance, recalculates the status, notifies the intern, and logs it', function () {
        asAdminUser($this->admin, 'POST', "/api/admin/corrections/{$this->correction->id}/approve", [
            'clock_in' => '08:02', 'clock_out' => '17:00', 'note' => 'Sesuai bukti listrik padam.',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Koreksi disetujui. Status absensi dihitung ulang.')
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.recorded.status', 'present')
            ->assertJsonPath('data.final', ['clock_in' => '08:02', 'clock_out' => '17:00'])
            ->assertJsonPath('data.decision_note', 'Sesuai bukti listrik padam.')
            ->assertJsonPath('data.decided_by', 'Admin Sinta')
            ->assertJsonPath('data.can_decide', false);

        $this->attendance->refresh();
        expect($this->attendance->clock_out_at)->toBe('17:00:00')
            ->and($this->attendance->is_corrected)->toBeTrue()
            ->and($this->attendance->clock_in_office_id)->toBe($this->office->id)
            ->and(Attendance::query()->count())->toBe(1);

        $notification = Notification::sole();
        expect($notification->user_id)->toBe($this->rina->id)
            ->and($notification->text)->toBe('Koreksi absensi 9 Okt disetujui.')
            ->and($notification->link_path)->toBe('/absensi')
            ->and($notification->link_params)->toBe(['tab' => 'koreksi', 'open' => $this->correction->id]);

        $log = AuditLog::sole();
        expect($log->action)->toBe('Absensi')
            ->and($log->object)->toBe('Rina Wulandari')
            ->and($log->detail)->toBe('Setujui koreksi 9 Okt: 08:02 - 17:00.');

        // Intern melihat label "Dikoreksi admin" (12, 11, 10, lalu 9 Okt) dan badge menu admin berkurang.
        asAdminUser($this->rina, 'GET', '/api/intern/attendance?month=2026-10')
            ->assertJsonPath('data.days.3.date', '2026-10-09')
            ->assertJsonPath('data.days.3.status', 'present')
            ->assertJsonPath('data.days.3.is_corrected', true);
        asAdminUser($this->admin, 'GET', '/api/admin/menu')->assertJsonPath('data.3.badge', 0);
    });

    it('lets the admin set final times that differ from the request, and recalculates lateness', function () {
        asAdminUser($this->admin, 'POST', "/api/admin/corrections/{$this->correction->id}/approve", [
            'clock_in' => '08:30', 'clock_out' => '17:05', 'note' => 'Jam masuk sesuai CCTV.',
        ])->assertOk();

        asAdminUser($this->admin, 'GET', "/api/admin/users/{$this->rina->id}/attendance/days/2026-10-09")
            ->assertJsonPath('data.clock_in_at', '08:30')
            ->assertJsonPath('data.late_minutes', 30)
            ->assertJsonPath('data.is_corrected', true);
    });

    it('creates the attendance for a day without clock in', function () {
        $absent = AttendanceCorrection::factory()->for($this->budi, 'intern')->create([
            'date' => '2026-10-08', 'recorded_clock_in' => null, 'recorded_clock_out' => null,
        ]);

        asAdminUser($this->admin, 'GET', "/api/admin/corrections/{$absent->id}")->assertJsonPath('data.recorded.status', 'absent');

        asAdminUser($this->admin, 'POST', "/api/admin/corrections/{$absent->id}/approve", [
            'clock_in' => '08:00', 'clock_out' => '17:00', 'note' => 'Hadir rapat di luar kantor.',
        ])
            ->assertOk()
            ->assertJsonPath('data.recorded.status', 'present');

        $attendance = Attendance::query()->where('intern_id', $this->budi->id)->sole();
        expect($attendance->date->toDateString())->toBe('2026-10-08')
            ->and($attendance->is_corrected)->toBeTrue()
            ->and($attendance->clock_in_office_id)->toBeNull();
    });

    it('validates the note and the final times', function (array $input, string $field, string $message) {
        asAdminUser($this->admin, 'POST', "/api/admin/corrections/{$this->correction->id}/approve", [
            'clock_in' => '08:02', 'clock_out' => '17:00', 'note' => 'Sesuai bukti.', ...$input,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field => $message]);

        expect($this->correction->refresh()->status)->toBe(RequestStatus::Pending);
    })->with([
        'catatan kosong' => [['note' => ' '], 'note', 'Catatan verifikasi wajib diisi.'],
        'clock out lebih awal' => [['clock_out' => '08:00'], 'clock_out', 'Jam clock out harus setelah jam clock in.'],
        'format jam' => [['clock_in' => '8 pagi'], 'clock_in', 'Format jam tidak valid. Gunakan JJ:MM.'],
    ]);
});

describe('tolak', function () {
    it('closes the request without touching the attendance', function () {
        asAdminUser($this->admin, 'POST', "/api/admin/corrections/{$this->correction->id}/reject", ['note' => 'Tidak ada bukti.'])
            ->assertOk()
            ->assertJsonPath('message', 'Koreksi ditolak. Data absensi tidak berubah.')
            ->assertJsonPath('data.status', 'rejected')
            ->assertJsonPath('data.final', null)
            ->assertJsonPath('data.recorded.status', 'missed_clock_out');

        expect($this->attendance->refresh()->clock_out_at)->toBeNull()
            ->and($this->attendance->is_corrected)->toBeFalse()
            ->and(Notification::sole()->text)->toBe('Koreksi absensi 9 Okt ditolak.')
            ->and(AuditLog::sole()->detail)->toBe('Tolak koreksi 9 Okt.');
    });

    it('requires a verification note', function () {
        asAdminUser($this->admin, 'POST', "/api/admin/corrections/{$this->correction->id}/reject", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['note' => 'Catatan verifikasi wajib diisi.']);
    });
});

describe('sudah diproses', function () {
    it('tells the second admin who already processed the request', function () {
        $rudi = User::factory()->admin()->create(['name' => 'Admin Rudi']);
        asAdminUser($rudi, 'POST', "/api/admin/corrections/{$this->correction->id}/reject", ['note' => 'Tidak ada bukti.'])->assertOk();

        asAdminUser($this->admin, 'POST', "/api/admin/corrections/{$this->correction->id}/approve", [
            'clock_in' => '08:02', 'clock_out' => '17:00', 'note' => 'Sesuai bukti.',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'already_processed')
            ->assertJsonPath('message', 'Permintaan ini sudah diproses oleh Admin Rudi.');

        expect($this->attendance->refresh()->clock_out_at)->toBeNull()
            ->and(AuditLog::query()->count())->toBe(1);
    });

    it('rejects a decision on a request the intern cancelled', function () {
        asAdminUser($this->rina, 'POST', "/api/intern/attendance-corrections/{$this->correction->id}/cancel")->assertOk();

        asAdminUser($this->admin, 'POST', "/api/admin/corrections/{$this->correction->id}/reject", ['note' => 'Tidak ada bukti.'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'cancelled')
            ->assertJsonPath('message', 'Permintaan ini sudah dibatalkan intern.');
    });

    it('stops the intern from cancelling after the admin decided', function () {
        asAdminUser($this->admin, 'POST', "/api/admin/corrections/{$this->correction->id}/reject", ['note' => 'Tidak ada bukti.'])->assertOk();

        asAdminUser($this->rina, 'POST', "/api/intern/attendance-corrections/{$this->correction->id}/cancel")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Data ini sudah diproses oleh Admin Sinta.');
    });
});

it('rejects interns and mentors from the admin correction pages', function (string $role) {
    $actor = User::factory()->{$role}()->create();

    asAdminUser($actor, 'GET', '/api/admin/corrections')->assertForbidden();
    asAdminUser($actor, 'POST', "/api/admin/corrections/{$this->correction->id}/reject", ['note' => 'x'])->assertForbidden();
})->with(['intern', 'mentor']);
