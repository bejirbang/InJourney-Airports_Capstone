<?php

use App\Enums\PresentationStatus;
use App\Models\Airport;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\FinalPresentation;
use App\Models\Logbook;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-12-26 10:00:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Sinta Admin']);
    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->soetta = Airport::factory()->create(['name' => 'Soekarno-Hatta']);
    $this->halim = Airport::factory()->create(['name' => 'Halim Perdanakusuma']);
    $this->rizki = presenter($this, 'Rizki Pratama', '2026-12-31');
});

function presenter($test, string $name, string $endDate, array $profile = []): User
{
    return User::factory()->intern([
        'mentor_id' => $test->mentor->id,
        'airport_id' => $test->soetta->id,
        'start_date' => '2026-09-01',
        'end_date' => $endDate,
        ...$profile,
    ])->create(['name' => $name]);
}

function adminPresentations(User $user, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

describe('daftar', function () {
    it('lists pending evidence oldest first with the counts per tab', function () {
        $dimas = presenter($this, 'Dimas Aji', '2026-12-30');
        $late = FinalPresentation::factory()->create(['intern_id' => $this->rizki->id, 'submitted_at' => '2026-12-25 10:00:00', 'evidence_url' => 'https://drive.google.com/x']);
        $early = FinalPresentation::factory()->create(['intern_id' => $dimas->id, 'submitted_at' => '2026-12-24 09:00:00']);
        FinalPresentation::factory()->approved($this->admin)->create();
        FinalPresentation::factory()->revision($this->admin)->create();

        adminPresentations($this->admin, 'GET', '/api/admin/presentations')
            ->assertOk()
            ->assertJsonPath('data.*.id', [$early->id, $late->id])
            ->assertJsonPath('data.1', [
                'id' => $late->id,
                'intern' => ['id' => $this->rizki->id, 'name' => 'Rizki Pratama', 'short_name' => 'Rizki P.'],
                'mentor' => ['id' => $this->mentor->id, 'name' => 'Sari Wijaya'],
                'airport' => ['id' => $this->soetta->id, 'name' => 'Soekarno-Hatta'],
                'end_date' => '2026-12-31',
                'days_left' => 5,
                'status' => 'pending',
                'evidence_url' => 'https://drive.google.com/x',
                'submitted_at' => '2026-12-25T10:00:00+07:00',
                'decision_note' => null,
                'decided_by' => null,
                'decided_at' => null,
                'can_decide' => true,
            ])
            ->assertJsonPath('meta', ['pending' => 2, 'revision' => 1, 'approved' => 1, 'not_submitted' => 0]);
    });

    it('lists interns past H-7 who have not sent anything yet', function () {
        $dimas = presenter($this, 'Dimas Aji', '2027-01-02');
        presenter($this, 'Belum H-7', '2027-01-03');
        presenter($this, 'Sudah Selesai', '2026-12-25');
        presenter($this, 'Akun Nonaktif', '2026-12-30')->update(['is_active' => false]);
        FinalPresentation::factory()->create(['intern_id' => presenter($this, 'Sudah Kirim', '2026-12-30')->id]);

        adminPresentations($this->admin, 'GET', '/api/admin/presentations?tab=not_submitted')
            ->assertOk()
            ->assertJsonPath('data.*.intern.id', [$this->rizki->id, $dimas->id])
            ->assertJsonPath('data.0.id', null)
            ->assertJsonPath('data.0.status', 'not_submitted')
            ->assertJsonPath('data.0.can_decide', false)
            ->assertJsonPath('meta.not_submitted', 2);
    });

    it('filters every tab by airport', function () {
        $budi = presenter($this, 'Budi Halim', '2026-12-30', ['airport_id' => $this->halim->id]);
        FinalPresentation::factory()->create(['intern_id' => $budi->id]);
        FinalPresentation::factory()->create(['intern_id' => $this->rizki->id]);

        adminPresentations($this->admin, 'GET', "/api/admin/presentations?airport_id={$this->halim->id}")
            ->assertJsonPath('data.*.intern.id', [$budi->id])
            ->assertJsonPath('meta.pending', 1);
    });

    it('shows the pending count on the menu', function () {
        FinalPresentation::factory()->count(2)->create();
        FinalPresentation::factory()->approved()->create();

        adminPresentations($this->admin, 'GET', '/api/admin/menu')
            ->assertJsonPath('data.5', ['key' => 'presentations', 'path' => '/admin/presentations', 'badge' => 2]);
    });

    it('rejects interns and mentors', function () {
        adminPresentations($this->mentor, 'GET', '/api/admin/presentations')->assertForbidden();
        adminPresentations($this->rizki, 'GET', '/api/admin/presentations')->assertForbidden();
    });
});

describe('keputusan', function () {
    beforeEach(function () {
        $this->presentation = FinalPresentation::factory()->create(['intern_id' => $this->rizki->id]);
    });

    it('approves the evidence, logs it, and tells the intern and the mentor', function () {
        Logbook::factory()->pendingReview()->for(Attendance::factory()->for($this->rizki, 'intern')->create(['date' => '2026-12-24']))->create();

        adminPresentations($this->admin, 'POST', "/api/admin/presentations/{$this->presentation->id}/approve")
            ->assertOk()
            ->assertJsonPath('message', 'Presentasi akhir disetujui.')
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.decided_by', 'Sinta Admin')
            ->assertJsonPath('data.decided_at', '2026-12-26T10:00:00+07:00')
            ->assertJsonPath('data.can_decide', false);

        $log = AuditLog::sole();
        expect($log->action)->toBe('Presentasi')
            ->and($log->object)->toBe('Rizki Pratama')
            ->and($log->detail)->toBe('Setujui bukti presentasi akhir.')
            ->and(Notification::query()->orderBy('id')->get(['user_id', 'text', 'link_path', 'link_params'])->toArray())->toBe([
                ['user_id' => $this->rizki->id, 'text' => 'Presentasi akhir Anda disetujui.', 'link_path' => '/presentasi', 'link_params' => null],
                ['user_id' => $this->mentor->id, 'text' => 'Presentasi akhir Rizki P. disetujui.', 'link_path' => '/penilaian', 'link_params' => ['open' => $this->rizki->id]],
            ]);
    });

    it('tells the mentor the intern is ready when every logbook is already approved', function () {
        Logbook::factory()->approved($this->mentor)->for(Attendance::factory()->for($this->rizki, 'intern')->create(['date' => '2026-12-24']))->create();

        adminPresentations($this->admin, 'POST', "/api/admin/presentations/{$this->presentation->id}/approve")->assertOk();

        expect(Notification::query()->where('user_id', $this->mentor->id)->pluck('text')->all())->toBe(['Rizki P. siap dinilai.']);
    });

    it('asks for a revision with a required note', function () {
        adminPresentations($this->admin, 'POST', "/api/admin/presentations/{$this->presentation->id}/revise")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['note' => 'Catatan wajib diisi.']);

        adminPresentations($this->admin, 'POST', "/api/admin/presentations/{$this->presentation->id}/revise", ['note' => 'Link tidak bisa dibuka.'])
            ->assertOk()
            ->assertJsonPath('message', 'Permintaan revisi terkirim ke intern.')
            ->assertJsonPath('data.status', 'revision')
            ->assertJsonPath('data.decision_note', 'Link tidak bisa dibuka.');

        expect(AuditLog::sole()->detail)->toBe('Minta revisi bukti presentasi akhir.')
            ->and(Notification::sole()->only(['user_id', 'text']))->toBe(['user_id' => $this->rizki->id, 'text' => 'Bukti presentasi perlu diperbaiki.']);
    });

    it('rejects a decision on evidence that is no longer pending', function () {
        $this->presentation->update(['status' => PresentationStatus::Approved, 'decided_by' => $this->admin->id]);

        adminPresentations(User::factory()->admin()->create(), 'POST', "/api/admin/presentations/{$this->presentation->id}/revise", ['note' => 'Coba lagi.'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'already_processed')
            ->assertJsonPath('message', 'Data ini sudah diproses oleh Sinta Admin.');

        expect(FinalPresentation::sole()->status)->toBe(PresentationStatus::Approved)->and(AuditLog::count())->toBe(0);
    });
});
