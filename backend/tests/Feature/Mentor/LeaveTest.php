<?php

use App\Enums\LeaveType;
use App\Enums\RequestStatus;
use App\Models\LeaveRequest;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

// "Hari ini" sama dengan prototipe frontend: Senin, 12 Oktober 2026 pukul 14:39.
beforeEach(function () {
    Storage::fake();
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->mentor = User::factory()->mentor()->create(['name' => 'Bu Sari']);
    $this->andi = leaveIntern($this->mentor, 'Andi Pratama');
    $this->dewi = leaveIntern($this->mentor, 'Dewi Sartika');

    $this->leave = LeaveRequest::factory()->for($this->andi, 'intern')->create([
        'type' => LeaveType::Sick,
        'start_date' => '2026-10-13',
        'end_date' => '2026-10-14',
        'reason' => 'Demam, disarankan istirahat dokter.',
        'evidence_path' => 'leaves/1/surat.pdf',
        'created_at' => '2026-10-12 00:39:00',
    ]);
    Storage::put('leaves/1/surat.pdf', str_repeat('x', 2048));
});

function leaveIntern(User $mentor, string $name): User
{
    return User::factory()->intern([
        'mentor_id' => $mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create(['name' => $name]);
}

function mentorLeaves(User $user, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

describe('daftar izin', function () {
    it('shows pending leaves of current interns, longest pending first', function () {
        $older = LeaveRequest::factory()->for($this->dewi, 'intern')->create([
            'type' => LeaveType::Urgent, 'start_date' => '2026-10-13', 'end_date' => '2026-10-13', 'created_at' => '2026-10-11 12:39:00',
        ]);
        LeaveRequest::factory()->for($this->andi, 'intern')->approved()->create(['start_date' => '2026-10-05', 'end_date' => '2026-10-05']);
        LeaveRequest::factory()->for(User::factory()->intern()->create(), 'intern')->create();

        mentorLeaves($this->mentor, 'GET', '/api/mentor/leaves')
            ->assertOk()
            ->assertJsonPath('meta.pending_count', 2)
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0', [
                'id' => $older->id,
                'intern' => ['id' => $this->dewi->id, 'name' => 'Dewi Sartika', 'short_name' => 'Dewi S.'],
                'type' => 'urgent',
                'start_date' => '2026-10-13',
                'end_date' => '2026-10-13',
                'working_days' => 1,
                'has_evidence' => false,
                'status' => 'pending',
                'submitted_at' => '2026-10-11T12:39:00+07:00',
                'submitted_late' => false,
                'pending_hours' => 26,
                'is_overdue' => true,
                'decided_by' => null,
                'decided_at' => null,
                'can_decide' => true,
            ])
            ->assertJsonPath('data.1.id', $this->leave->id)
            ->assertJsonPath('data.1.pending_hours', 14)
            ->assertJsonPath('data.1.is_overdue', false)
            ->assertJsonPath('data.1.working_days', 2)
            ->assertJsonMissingPath('data.1.reason');
    });

    it('shows every status on the all tab, pending first then newest', function () {
        $approved = LeaveRequest::factory()->for($this->andi, 'intern')->approved()->create([
            'start_date' => '2026-10-05', 'end_date' => '2026-10-05', 'created_at' => '2026-10-04 09:00:00', 'decided_by' => $this->mentor->id,
        ]);
        $cancelled = LeaveRequest::factory()->for($this->dewi, 'intern')->create([
            'status' => RequestStatus::Cancelled, 'start_date' => '2026-10-02', 'end_date' => '2026-10-02', 'created_at' => '2026-10-08 09:00:00',
        ]);

        mentorLeaves($this->mentor, 'GET', '/api/mentor/leaves?tab=all')
            ->assertOk()
            ->assertJsonPath('meta.pending_count', 1)
            ->assertJsonPath('data.0.id', $this->leave->id)
            ->assertJsonPath('data.1.id', $cancelled->id)
            ->assertJsonPath('data.1.pending_hours', null)
            ->assertJsonPath('data.1.can_decide', false)
            ->assertJsonPath('data.2.id', $approved->id)
            ->assertJsonPath('data.2.decided_by', ['name' => 'Bu Sari', 'role' => 'mentor']);
    });

    it('filters by type and intern', function () {
        LeaveRequest::factory()->for($this->dewi, 'intern')->create(['type' => LeaveType::Urgent]);

        mentorLeaves($this->mentor, 'GET', '/api/mentor/leaves?type=urgent')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.type', 'urgent');
        mentorLeaves($this->mentor, 'GET', "/api/mentor/leaves?intern_id={$this->andi->id}")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $this->leave->id);
        mentorLeaves($this->mentor, 'GET', '/api/mentor/leaves?tab=semua')->assertUnprocessable();
    });
});

describe('detail dan lampiran', function () {
    it('shows the reason and evidence', function () {
        mentorLeaves($this->mentor, 'GET', "/api/mentor/leaves/{$this->leave->id}")
            ->assertOk()
            ->assertJsonPath('data.reason', 'Demam, disarankan istirahat dokter.')
            ->assertJsonPath('data.decision_note', null)
            ->assertJsonPath('data.evidence', ['name' => 'lampiran-izin-2026-10-13.pdf', 'size' => 2048])
            ->assertJsonPath('data.can_decide', true);
    });

    it('downloads or previews the evidence', function () {
        mentorLeaves($this->mentor, 'GET', "/api/mentor/leaves/{$this->leave->id}/evidence")
            ->assertOk()
            ->assertDownload('lampiran-izin-2026-10-13.pdf');

        $inline = mentorLeaves($this->mentor, 'GET', "/api/mentor/leaves/{$this->leave->id}/evidence?inline=1")->assertOk();
        expect($inline->headers->get('Content-Disposition'))->toStartWith('inline');
    });

    it('marks a leave without evidence', function () {
        $leave = LeaveRequest::factory()->for($this->dewi, 'intern')->create();

        mentorLeaves($this->mentor, 'GET', "/api/mentor/leaves/{$leave->id}")
            ->assertOk()
            ->assertJsonPath('data.has_evidence', false)
            ->assertJsonPath('data.evidence', null);
        mentorLeaves($this->mentor, 'GET', "/api/mentor/leaves/{$leave->id}/evidence")->assertNotFound();
    });

    it('rejects leaves of interns this mentor does not mentor', function (string $suffix) {
        $other = LeaveRequest::factory()->for(User::factory()->intern()->create(), 'intern')->create();

        mentorLeaves($this->mentor, $suffix === '' || $suffix === '/evidence' ? 'GET' : 'POST', "/api/mentor/leaves/{$other->id}{$suffix}", ['note' => 'Oke'])
            ->assertForbidden()
            ->assertJsonPath('message', 'Anda tidak memiliki akses ke izin ini.');
    })->with(['', '/evidence', '/approve', '/reject']);

    it('rejects interns and admins', function (string $role) {
        mentorLeaves(User::factory()->{$role}()->create(), 'GET', '/api/mentor/leaves')->assertForbidden();
    })->with(['intern', 'admin']);
});

describe('Setujui dan Tolak', function () {
    it('approves with a note, notifies the intern, and turns the attendance into Izin', function () {
        mentorLeaves($this->mentor, 'POST', "/api/mentor/leaves/{$this->leave->id}/approve", ['note' => 'Semoga lekas sembuh.'])
            ->assertOk()
            ->assertJsonPath('message', 'Izin disetujui. Intern sudah diberi tahu.')
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.decision_note', 'Semoga lekas sembuh.')
            ->assertJsonPath('data.decided_by', ['name' => 'Bu Sari', 'role' => 'mentor'])
            ->assertJsonPath('data.decided_at', '2026-10-12T14:39:00+07:00')
            ->assertJsonPath('data.can_decide', false);

        $notification = Notification::sole();
        expect($notification->user_id)->toBe($this->andi->id)
            ->and($notification->text)->toBe('Izin Sakit 13-14 Okt disetujui.')
            ->and($notification->link_path)->toBe('/izin')
            ->and($notification->link_params)->toBe(['open' => $this->leave->id]);

        $this->travelTo(Carbon::parse('2026-10-15 09:00:00'));
        $days = collect(mentorLeaves($this->mentor, 'GET', "/api/mentor/interns/{$this->andi->id}/attendance")->json('data.days'))->keyBy('date');

        expect($days['2026-10-13']['status'])->toBe('leave')
            ->and($days['2026-10-14']['status'])->toBe('leave')
            ->and($days['2026-10-13']['leave_type'])->toBe('sick');
    });

    it('rejects with a note and notifies the intern', function () {
        mentorLeaves($this->mentor, 'POST', "/api/mentor/leaves/{$this->leave->id}/reject", ['note' => 'Mohon lampirkan surat dokter yang jelas.'])
            ->assertOk()
            ->assertJsonPath('message', 'Izin ditolak. Intern sudah diberi tahu.')
            ->assertJsonPath('data.status', 'rejected');

        expect(Notification::sole()->text)->toBe('Izin Sakit 13-14 Okt ditolak.');
    });

    it('lets the mentor decide a leave without evidence', function () {
        $leave = LeaveRequest::factory()->for($this->dewi, 'intern')->create();

        mentorLeaves($this->mentor, 'POST', "/api/mentor/leaves/{$leave->id}/approve", ['note' => 'Oke'])->assertOk();
    });

    it('requires a note', function (string $action) {
        mentorLeaves($this->mentor, 'POST', "/api/mentor/leaves/{$this->leave->id}/{$action}", ['note' => '  '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['note' => 'Catatan wajib diisi.']);

        expect($this->leave->fresh()->status)->toBe(RequestStatus::Pending);
    })->with(['approve', 'reject']);

    it('rejects a decision once the leave is closed', function (Closure $close, string $message, string $reason) {
        $close($this->leave);

        mentorLeaves($this->mentor, 'POST', "/api/mentor/leaves/{$this->leave->id}/approve", ['note' => 'Oke'])
            ->assertUnprocessable()
            ->assertJsonPath('message', $message)
            ->assertJsonPath('reason', $reason);

        expect(Notification::count())->toBe(0);
    })->with([
        'dibatalkan intern' => [fn (LeaveRequest $l) => $l->update(['status' => RequestStatus::Cancelled]), 'Pengajuan ini sudah dibatalkan intern.', 'cancelled'],
        'diproses admin' => [fn (LeaveRequest $l) => $l->update(['status' => RequestStatus::Approved, 'decided_by' => User::factory()->admin()->create()->id]), 'Izin ini sudah diproses oleh admin.', 'already_processed'],
        'sudah diputuskan mentor' => [fn (LeaveRequest $l) => $l->update(['status' => RequestStatus::Rejected, 'decided_by' => test()->mentor->id]), 'Izin ini sudah diproses oleh Bu Sari.', 'already_processed'],
    ]);

    it('stops the intern from cancelling after the decision', function () {
        mentorLeaves($this->mentor, 'POST', "/api/mentor/leaves/{$this->leave->id}/approve", ['note' => 'Oke'])->assertOk();

        mentorLeaves($this->andi, 'POST', "/api/intern/leaves/{$this->leave->id}/cancel")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Izin ini sudah diproses oleh Bu Sari.');
    });
});
