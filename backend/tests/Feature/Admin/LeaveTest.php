<?php

use App\Enums\LeaveType;
use App\Enums\RequestStatus;
use App\Models\AuditLog;
use App\Models\LeaveRequest;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

// Senin, 12 Oktober 2026 pukul 14:39.
beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));
    Storage::fake();

    $this->admin = User::factory()->admin()->create(['name' => 'Admin Sinta']);
    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->andi = User::factory()->intern(['mentor_id' => $this->mentor->id, 'start_date' => '2026-09-01', 'end_date' => '2026-12-31'])
        ->create(['name' => 'Andi Pratama']);

    // Diajukan 30 jam lalu, dengan surat dokter.
    Storage::put('leaves/surat.pdf', 'surat');
    $this->overdue = LeaveRequest::factory()->for($this->andi, 'intern')->create([
        'type' => LeaveType::Sick, 'start_date' => '2026-10-13', 'end_date' => '2026-10-14',
        'reason' => 'Demam.', 'evidence_path' => 'leaves/surat.pdf', 'created_at' => '2026-10-11 08:39:00',
    ]);
});

function adminLeaves(User $user, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

function approveLeave(LeaveRequest $leave, array $data = []): TestResponse
{
    return adminLeaves(test()->admin, 'POST', "/api/admin/leaves/{$leave->id}/approve", [
        'note' => 'Surat dokter sudah diperiksa.', 'evidence_checked' => true, ...$data,
    ]);
}

describe('daftar dan detail', function () {
    it('lists pending leaves of every intern with mentor, overdue mark, and decision buttons', function () {
        $dewi = User::factory()->intern()->create(['name' => 'Dewi Sartika']);
        $fresh = LeaveRequest::factory()->for($dewi, 'intern')->create(['type' => LeaveType::Urgent, 'created_at' => '2026-10-12 08:00:00']);
        LeaveRequest::factory()->for($dewi, 'intern')->approved()->create(['created_at' => '2026-10-01 08:00:00']);

        adminLeaves($this->admin, 'GET', '/api/admin/leaves')
            ->assertOk()
            ->assertJsonPath('data.*.id', [$this->overdue->id, $fresh->id])
            ->assertJsonPath('data.0.intern.short_name', 'Andi P.')
            ->assertJsonPath('data.0.mentor', ['id' => $this->mentor->id, 'name' => 'Sari Wijaya'])
            ->assertJsonPath('data.0.working_days', 2)
            ->assertJsonPath('data.0.has_evidence', true)
            ->assertJsonPath('data.0.pending_hours', 30)
            ->assertJsonPath('data.0.is_overdue', true)
            ->assertJsonPath('data.0.can_decide', true)
            ->assertJsonPath('data.0.can_approve', true)
            ->assertJsonPath('data.1.is_overdue', false)
            ->assertJsonPath('data.1.can_decide', true)
            ->assertJsonPath('data.1.can_approve', false)
            ->assertJsonPath('meta.pending_count', 2)
            ->assertJsonPath('meta.interns.*.name', ['Andi Pratama', 'Dewi Sartika']);

        adminLeaves($this->admin, 'GET', '/api/admin/leaves?tab=all')->assertJsonCount(3, 'data');
        adminLeaves($this->admin, 'GET', '/api/admin/leaves?tab=all&type=urgent')->assertJsonPath('data.*.id', [$fresh->id]);
        adminLeaves($this->admin, 'GET', "/api/admin/leaves?tab=all&intern_id={$this->andi->id}")->assertJsonPath('data.*.id', [$this->overdue->id]);
    });

    it('shows the detail with reason and attachment, and streams the attachment', function () {
        adminLeaves($this->admin, 'GET', "/api/admin/leaves/{$this->overdue->id}")
            ->assertOk()
            ->assertJsonPath('data.reason', 'Demam.')
            ->assertJsonPath('data.evidence', ['name' => 'lampiran-izin-2026-10-13.pdf', 'size' => 5]);

        adminLeaves($this->admin, 'GET', "/api/admin/leaves/{$this->overdue->id}/evidence")
            ->assertOk()
            ->assertDownload('lampiran-izin-2026-10-13.pdf');
    });

    it('disables approve for a leave without attachment', function () {
        $this->overdue->update(['evidence_path' => null]);

        adminLeaves($this->admin, 'GET', "/api/admin/leaves/{$this->overdue->id}")
            ->assertJsonPath('data.can_decide', true)
            ->assertJsonPath('data.can_approve', false);
    });
});

describe('setujui dan tolak', function () {
    it('approves an overdue leave with checked evidence, notifies intern and mentor, and logs it', function () {
        approveLeave($this->overdue)
            ->assertOk()
            ->assertJsonPath('message', 'Izin disetujui. Intern dan mentor sudah diberi tahu.')
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.decided_by', ['name' => 'Admin Sinta', 'role' => 'admin'])
            ->assertJsonPath('data.decision_note', 'Surat dokter sudah diperiksa.')
            ->assertJsonPath('data.can_decide', false);

        expect(Notification::query()->orderBy('id')->get(['user_id', 'text', 'link_path'])->toArray())->toBe([
            ['user_id' => $this->andi->id, 'text' => 'Izin Sakit 13-14 Okt disetujui.', 'link_path' => '/izin'],
            ['user_id' => $this->mentor->id, 'text' => 'Izin Andi P. diproses oleh admin.', 'link_path' => '/izin'],
        ]);

        $log = AuditLog::sole();
        expect($log->action)->toBe('Izin')
            ->and($log->object)->toBe('Andi Pratama')
            ->and($log->detail)->toBe('Setujui Izin Sakit 13-14 Okt.');

        // Mentor melihat "Diproses oleh admin"; hari izin terbaca Izin di kalender intern.
        adminLeaves($this->mentor, 'GET', '/api/mentor/leaves?tab=all')->assertJsonPath('data.0.decided_by.role', 'admin');
        $this->travelTo(Carbon::parse('2026-10-15 09:00:00'));
        adminLeaves($this->admin, 'GET', "/api/admin/users/{$this->andi->id}/attendance/days/2026-10-13")->assertJsonPath('data.status', 'leave');
    });

    it('rejects an overdue leave even without attachment', function () {
        $this->overdue->update(['evidence_path' => null]);

        adminLeaves($this->admin, 'POST', "/api/admin/leaves/{$this->overdue->id}/reject", ['note' => 'Tidak ada surat dokter.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');

        expect(Notification::query()->pluck('text')->all())->toBe(['Izin Sakit 13-14 Okt ditolak.', 'Izin Andi P. diproses oleh admin.'])
            ->and(AuditLog::sole()->detail)->toBe('Tolak Izin Sakit 13-14 Okt.');
    });

    it('enforces the admin rules', function (Closure $setup, Closure $request, string $reason, string $message) {
        $setup($this->overdue);
        $before = $this->overdue->refresh()->status;

        $request($this->overdue)
            ->assertUnprocessable()
            ->assertJsonPath('reason', $reason)
            ->assertJsonPath('message', $message);

        expect($this->overdue->refresh()->status)->toBe($before)
            ->and(Notification::query()->count())->toBe(0)
            ->and(AuditLog::query()->count())->toBe(0);
    })->with([
        'setujui sebelum lewat 24 jam' => [
            fn (LeaveRequest $l) => LeaveRequest::query()->whereKey($l->id)->update(['created_at' => '2026-10-11 14:39:00']),
            fn (LeaveRequest $l) => approveLeave($l),
            'not_overdue',
            'Izin ini masih menunggu mentor. Admin dapat menyetujuinya setelah Pending lebih dari 24 jam.',
        ],
        'tanpa bukti' => [
            fn (LeaveRequest $l) => $l->update(['evidence_path' => null]),
            fn (LeaveRequest $l) => approveLeave($l),
            'no_evidence',
            'Tidak ada surat resmi atau bukti.',
        ],
        'belum centang bukti' => [
            fn (LeaveRequest $l) => null,
            fn (LeaveRequest $l) => approveLeave($l, ['evidence_checked' => false]),
            'evidence_unchecked',
            'Centang "Saya sudah memeriksa surat resmi atau bukti" lebih dulu.',
        ],
        'sudah diproses mentor' => [
            fn (LeaveRequest $l) => $l->update(['status' => RequestStatus::Approved, 'decided_by' => test()->mentor->id]),
            fn (LeaveRequest $l) => approveLeave($l),
            'already_processed',
            'Izin ini sudah diproses oleh mentor.',
        ],
        'sudah diproses admin lain' => [
            fn (LeaveRequest $l) => $l->update(['status' => RequestStatus::Rejected, 'decided_by' => User::factory()->admin()->create()->id]),
            fn (LeaveRequest $l) => approveLeave($l),
            'already_processed',
            'Izin ini sudah diproses oleh admin.',
        ],
        'dibatalkan intern' => [
            fn (LeaveRequest $l) => $l->update(['status' => RequestStatus::Cancelled]),
            fn (LeaveRequest $l) => approveLeave($l),
            'cancelled',
            'Pengajuan ini sudah dibatalkan intern.',
        ],
    ]);

    it('lets the admin reject a pending leave before 24 hours', function () {
        LeaveRequest::query()->whereKey($this->overdue->id)->update(['created_at' => '2026-10-12 08:00:00']);

        adminLeaves($this->admin, 'GET', "/api/admin/leaves/{$this->overdue->id}")
            ->assertJsonPath('data.can_decide', true)
            ->assertJsonPath('data.can_approve', false);

        adminLeaves($this->admin, 'POST', "/api/admin/leaves/{$this->overdue->id}/reject", ['note' => 'Tanggal bentrok dengan presentasi.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');

        expect(AuditLog::sole()->detail)->toBe('Tolak Izin Sakit 13-14 Okt.');
    });

    it('requires a note', function () {
        approveLeave($this->overdue, ['note' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['note' => 'Catatan wajib diisi.']);
    });

    it('tells the mentor that the admin already processed the leave', function () {
        approveLeave($this->overdue)->assertOk();

        adminLeaves($this->mentor, 'POST', "/api/mentor/leaves/{$this->overdue->id}/reject", ['note' => 'Terlambat.'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Izin ini sudah diproses oleh admin.');
    });
});

describe('pengingat izin pending', function () {
    it('reminds every active admin once about leaves pending more than 24 hours', function () {
        $rudi = User::factory()->admin()->create();
        User::factory()->admin()->inactive()->create();
        LeaveRequest::factory()->for($this->andi, 'intern')->create(['start_date' => '2026-10-20', 'end_date' => '2026-10-20', 'created_at' => '2026-10-12 08:00:00']);

        $this->artisan('app:remind-overdue-leaves')->expectsOutput('1 pengingat izin pending dikirim.')->assertSuccessful();

        expect(Notification::query()->orderBy('user_id')->get(['user_id', 'text', 'link_path', 'link_params'])->toArray())->toBe([
            ['user_id' => $this->admin->id, 'text' => 'Izin Andi P. belum diproses mentor lebih dari 24 jam.', 'link_path' => '/izin', 'link_params' => ['open' => $this->overdue->id]],
            ['user_id' => $rudi->id, 'text' => 'Izin Andi P. belum diproses mentor lebih dari 24 jam.', 'link_path' => '/izin', 'link_params' => ['open' => $this->overdue->id]],
        ]);

        $this->artisan('app:remind-overdue-leaves')->expectsOutput('0 pengingat izin pending dikirim.')->assertSuccessful();
        expect(Notification::query()->count())->toBe(2);
    });

    it('skips leaves that were decided or cancelled', function () {
        $this->overdue->update(['status' => RequestStatus::Cancelled]);

        $this->artisan('app:remind-overdue-leaves')->expectsOutput('0 pengingat izin pending dikirim.')->assertSuccessful();
    });
});

it('rejects interns and mentors from the admin leave pages', function (string $role) {
    $actor = User::factory()->{$role}()->create();

    adminLeaves($actor, 'GET', '/api/admin/leaves')->assertForbidden();
    adminLeaves($actor, 'POST', "/api/admin/leaves/{$this->overdue->id}/approve", ['note' => 'x'])->assertForbidden();
})->with(['intern', 'mentor']);
