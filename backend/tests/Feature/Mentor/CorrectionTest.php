<?php

use App\Enums\AttendanceStatus;
use App\Enums\CorrectionStatus;
use App\Models\AttendanceCorrection;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 09:00:00'));

    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->admin = User::factory()->admin()->create();
    $this->nabila = User::factory()->intern(['mentor_id' => $this->mentor->id, 'start_date' => '2026-09-01', 'end_date' => '2026-12-31'])->create(['name' => 'Nabila Putri']);
    $this->dimas = User::factory()->intern(['mentor_id' => $this->mentor->id, 'start_date' => '2026-09-01', 'end_date' => '2026-12-31'])->create(['name' => 'Dimas Aji']);

    $this->correction = AttendanceCorrection::factory()->for($this->nabila, 'intern')->create([
        'date' => '2026-10-06',
        'reason' => 'Baterai HP habis.',
        'created_at' => '2026-10-07 08:00:00',
    ]);
});

function mentorCorrections(User $user, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

describe('daftar', function () {
    it('shows requests waiting for this mentor, oldest first, and all of them on the all tab', function () {
        $older = AttendanceCorrection::factory()->for($this->dimas, 'intern')->create(['date' => '2026-10-01', 'recorded_status' => AttendanceStatus::Late, 'created_at' => '2026-10-02 10:00:00']);
        $forwarded = AttendanceCorrection::factory()->for($this->dimas, 'intern')->pendingAdmin()->create(['date' => '2026-10-02', 'created_at' => '2026-10-08 10:00:00']);
        AttendanceCorrection::factory()->create();

        mentorCorrections($this->mentor, 'GET', '/api/mentor/corrections')
            ->assertOk()
            ->assertJsonPath('data.*.id', [$older->id, $this->correction->id])
            ->assertJsonPath('meta.pending_count', 2)
            ->assertJsonPath('data.1', [
                'id' => $this->correction->id,
                'intern' => ['id' => $this->nabila->id, 'name' => 'Nabila Putri', 'short_name' => 'Nabila P.'],
                'date' => '2026-10-06',
                'recorded_status' => 'present',
                'recorded_missed_clock_out' => true,
                'reason' => 'Baterai HP habis.',
                'status' => 'pending_mentor',
                'submitted_at' => '2026-10-07T08:00:00+07:00',
                'mentor' => ['id' => $this->mentor->id, 'name' => 'Sari Wijaya'],
                'mentor_note' => null,
                'mentor_decided_at' => null,
                'admin' => null,
                'admin_note' => null,
                'admin_decided_at' => null,
                'can_cancel' => false,
                'can_decide' => true,
            ]);

        mentorCorrections($this->mentor, 'GET', '/api/mentor/corrections?tab=all')
            ->assertJsonPath('data.*.id', [$forwarded->id, $this->correction->id, $older->id])
            ->assertJsonPath('data.0.can_decide', false);

        mentorCorrections($this->mentor, 'GET', "/api/mentor/corrections?tab=all&intern_id={$this->nabila->id}")
            ->assertJsonPath('data.*.id', [$this->correction->id]);
    });

    it('shows the count on the menu and the history on the intern detail tab', function () {
        mentorCorrections($this->mentor, 'GET', '/api/mentor/menu')
            ->assertJsonPath('data.3', ['key' => 'corrections', 'path' => '/mentor/corrections', 'badge' => 1]);

        mentorCorrections($this->mentor, 'GET', "/api/mentor/interns/{$this->nabila->id}/corrections")
            ->assertOk()
            ->assertJsonPath('data.*.id', [$this->correction->id]);
    });

    it('rejects an unknown tab', function () {
        mentorCorrections($this->mentor, 'GET', '/api/mentor/corrections?tab=pending_admin')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['tab' => 'Tab tidak valid.']);
    });
});

describe('ACC dan tolak', function () {
    it('forwards to the admin with an optional note and notifies the intern and the admins', function () {
        mentorCorrections($this->mentor, 'POST', "/api/mentor/corrections/{$this->correction->id}/approve", ['note' => 'Benar, intern hadir sampai sore.'])
            ->assertOk()
            ->assertJsonPath('message', 'Koreksi di-ACC dan diteruskan ke admin.')
            ->assertJsonPath('data.status', 'pending_admin')
            ->assertJsonPath('data.mentor_note', 'Benar, intern hadir sampai sore.')
            ->assertJsonPath('data.mentor_decided_at', '2026-10-12T09:00:00+07:00')
            ->assertJsonPath('data.can_decide', false);

        expect(Notification::query()->orderBy('id')->get(['user_id', 'text', 'link_path', 'link_params'])->toArray())->toBe([
            ['user_id' => $this->nabila->id, 'text' => 'Koreksi presensi 6 Okt disetujui mentor, menunggu admin.', 'link_path' => '/presensi', 'link_params' => ['tab' => 'koreksi', 'open' => $this->correction->id]],
            ['user_id' => $this->admin->id, 'text' => 'Koreksi Nabila P. 6 Okt menunggu keputusan admin.', 'link_path' => '/koreksi', 'link_params' => ['open' => $this->correction->id]],
        ]);
    });

    it('accepts ACC without a note', function () {
        mentorCorrections($this->mentor, 'POST', "/api/mentor/corrections/{$this->correction->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.mentor_note', null);
    });

    it('rejects with a required note and notifies only the intern', function () {
        mentorCorrections($this->mentor, 'POST', "/api/mentor/corrections/{$this->correction->id}/reject")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['note' => 'Catatan wajib diisi.']);

        mentorCorrections($this->mentor, 'POST', "/api/mentor/corrections/{$this->correction->id}/reject", ['note' => 'Intern tidak masuk hari itu.'])
            ->assertOk()
            ->assertJsonPath('message', 'Koreksi ditolak.')
            ->assertJsonPath('data.status', 'rejected_by_mentor');

        expect(Notification::sole()->only(['user_id', 'text']))->toBe([
            'user_id' => $this->nabila->id,
            'text' => 'Koreksi presensi 6 Okt ditolak mentor.',
        ]);
    });

    it('cannot change a decision or decide a cancelled request', function () {
        mentorCorrections($this->mentor, 'POST', "/api/mentor/corrections/{$this->correction->id}/approve")->assertOk();

        mentorCorrections($this->mentor, 'POST', "/api/mentor/corrections/{$this->correction->id}/reject", ['note' => 'Batal.'])
            ->assertUnprocessable()
            ->assertExactJson(['message' => 'Data ini sudah diproses oleh Sari Wijaya.', 'reason' => 'already_processed']);

        $cancelled = AttendanceCorrection::factory()->for($this->dimas, 'intern')->create(['status' => CorrectionStatus::Cancelled]);

        mentorCorrections($this->mentor, 'POST', "/api/mentor/corrections/{$cancelled->id}/approve")
            ->assertUnprocessable()
            ->assertExactJson(['message' => 'Pengajuan ini sudah dibatalkan intern.', 'reason' => 'cancelled']);
    });

    it('rejects requests of interns mentored by someone else', function () {
        $other = AttendanceCorrection::factory()->create();

        foreach (['GET' => '', 'POST' => '/approve'] as $method => $suffix) {
            mentorCorrections($this->mentor, $method, "/api/mentor/corrections/{$other->id}{$suffix}")
                ->assertForbidden()
                ->assertJsonPath('message', 'Anda tidak memiliki akses ke permintaan koreksi ini.');
        }

        expect($other->refresh()->status)->toBe(CorrectionStatus::PendingMentor);
    });

    it('moves a waiting request to the new mentor when the mentor is changed', function () {
        $budi = User::factory()->mentor()->create();

        mentorCorrections($this->admin, 'POST', "/api/admin/users/{$this->nabila->id}/mentor", ['mentor_id' => $budi->id])->assertOk();

        mentorCorrections($this->mentor, 'POST', "/api/mentor/corrections/{$this->correction->id}/approve")->assertForbidden();
        mentorCorrections($budi, 'POST', "/api/mentor/corrections/{$this->correction->id}/approve")->assertOk();
    });
});

it('rejects interns and admins', function (string $role) {
    mentorCorrections(User::factory()->{$role}()->create(), 'GET', '/api/mentor/corrections')->assertForbidden();
})->with(['intern', 'admin']);
