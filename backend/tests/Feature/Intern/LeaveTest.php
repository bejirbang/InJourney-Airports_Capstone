<?php

use App\Enums\LeaveType;
use App\Enums\RequestStatus;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake();
    $this->travelTo(Carbon::parse('2026-10-12 09:00:00'));

    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->intern = User::factory()->intern([
        'mentor_id' => $this->mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create(['name' => 'Andi Pratama']);
    $this->token = $this->intern->createToken('api')->plainTextToken;
});

function applyLeave(array $overrides = [])
{
    return test()->post('/api/intern/leaves', [
        'type' => 'sick',
        'start_date' => '2026-10-13',
        'end_date' => '2026-10-14',
        'reason' => 'Demam, istirahat sesuai saran dokter.',
        ...$overrides,
    ], ['Authorization' => 'Bearer '.test()->token, 'Accept' => 'application/json']);
}

function asLeaveIntern(string $method, string $uri)
{
    return test()->json($method, $uri, [], ['Authorization' => 'Bearer '.test()->token]);
}

function leaveFor(User $intern, array $attributes): LeaveRequest
{
    return LeaveRequest::factory()->for($intern, 'intern')->create($attributes);
}

it('submits a pending leave with its working days', function () {
    applyLeave()
        ->assertCreated()
        ->assertJsonPath('message', 'Izin diajukan. Menunggu mentor.')
        ->assertJsonPath('data.type', 'sick')
        ->assertJsonPath('data.start_date', '2026-10-13')
        ->assertJsonPath('data.end_date', '2026-10-14')
        ->assertJsonPath('data.working_days', 2)
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.has_evidence', false)
        ->assertJsonPath('data.submitted_late', false)
        ->assertJsonPath('data.decided_by', null)
        ->assertJsonPath('data.can_cancel', true);
});

it('notifies the mentor with the leave type and date range', function (string $type, string $start, string $end, string $text) {
    $id = applyLeave(['type' => $type, 'start_date' => $start, 'end_date' => $end])->assertCreated()->json('data.id');

    $notification = Notification::sole();
    expect($notification->user_id)->toBe($this->mentor->id)
        ->and($notification->text)->toBe($text)
        ->and($notification->link_path)->toBe('/izin')
        ->and($notification->link_params)->toBe(['open' => $id]);
})->with([
    'rentang satu bulan' => ['sick', '2026-10-13', '2026-10-14', 'Andi P. mengajukan Izin Sakit 13-14 Okt.'],
    'satu hari' => ['urgent', '2026-10-12', '2026-10-12', 'Andi P. mengajukan Izin Urgent 12 Okt.'],
    'beda bulan' => ['sick', '2026-09-30', '2026-10-02', 'Andi P. mengajukan Izin Sakit 30 Sep - 2 Okt.'],
]);

it('allows past dates and labels them as submitted after the leave date', function () {
    applyLeave(['start_date' => '2026-10-05', 'end_date' => '2026-10-05'])
        ->assertCreated()
        ->assertJsonPath('data.submitted_late', true);
});

it('counts only working days and recounts when admin adds a holiday', function () {
    $id = applyLeave(['start_date' => '2026-10-16', 'end_date' => '2026-10-19'])
        ->assertJsonPath('data.working_days', 2)
        ->json('data.id');

    Holiday::factory()->create(['date' => '2026-10-19', 'name' => 'Libur Nasional']);

    asLeaveIntern('GET', "/api/intern/leaves/{$id}")->assertJsonPath('data.working_days', 1);
});

it('previews the working days for the form', function () {
    Holiday::factory()->create(['date' => '2026-10-14', 'name' => 'Libur Nasional']);

    asLeaveIntern('GET', '/api/intern/leaves/working-days?start_date=2026-10-12&end_date=2026-10-18')
        ->assertOk()
        ->assertExactJson(['data' => ['working_days' => 4]]);

    asLeaveIntern('GET', '/api/intern/leaves/working-days?start_date=2026-10-14&end_date=2026-10-13')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['end_date' => 'Tanggal selesai harus sesudah tanggal mulai.']);
});

it('validates the form with the documented messages', function (array $overrides, string $field, string $message) {
    applyLeave($overrides)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);

    expect(LeaveRequest::count())->toBe(0)
        ->and(Notification::count())->toBe(0);
})->with([
    'tanpa jenis' => [['type' => ''], 'type', 'Pilih jenis izin.'],
    'cuti tidak ada' => [['type' => 'leave'], 'type', 'Pilih jenis izin.'],
    'tanpa tanggal' => [['start_date' => ''], 'start_date', 'Isi tanggal mulai dan selesai.'],
    'selesai sebelum mulai' => [['start_date' => '2026-10-14', 'end_date' => '2026-10-13'], 'end_date', 'Tanggal selesai harus sesudah tanggal mulai.'],
    'sebelum magang' => [['start_date' => '2026-08-31', 'end_date' => '2026-09-01'], 'start_date', 'Tanggal di luar periode magang.'],
    'setelah magang' => [['start_date' => '2026-12-31', 'end_date' => '2027-01-04'], 'start_date', 'Tanggal di luar periode magang.'],
    'hanya akhir pekan' => [['start_date' => '2026-10-17', 'end_date' => '2026-10-18'], 'start_date', 'Tanggal yang dipilih tidak mengandung hari kerja.'],
    'alasan kosong' => [['reason' => '  '], 'reason', 'Alasan wajib diisi.'],
    'lampiran lebih dari 2 MB' => [fn () => ['evidence' => UploadedFile::fake()->create('surat.pdf', 2049, 'application/pdf')], 'evidence', 'Ukuran file maksimal 2 MB.'],
    'lampiran gambar' => [fn () => ['evidence' => UploadedFile::fake()->image('surat.jpg')], 'evidence', 'Jenis file tidak diizinkan. Gunakan PDF, Word, Excel, atau PowerPoint.'],
]);

it('rejects dates overlapping a pending or approved leave', function (RequestStatus $status) {
    leaveFor($this->intern, ['start_date' => '2026-10-14', 'end_date' => '2026-10-15', 'status' => $status]);

    applyLeave()
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['start_date' => 'Sudah ada izin pada tanggal ini.']);
})->with([RequestStatus::Pending, RequestStatus::Approved]);

it('allows dates of a rejected or cancelled leave and of another intern’s leave', function (RequestStatus $status) {
    leaveFor($this->intern, ['start_date' => '2026-10-13', 'end_date' => '2026-10-14', 'status' => $status]);
    leaveFor(User::factory()->intern()->create(), ['start_date' => '2026-10-13', 'end_date' => '2026-10-14', 'status' => RequestStatus::Approved]);

    applyLeave()->assertCreated();
})->with([RequestStatus::Rejected, RequestStatus::Cancelled]);

it('stores optional evidence privately and lets the intern download it', function () {
    $id = applyLeave(['evidence' => UploadedFile::fake()->create('surat-dokter.pdf', 400, 'application/pdf')])
        ->assertCreated()
        ->assertJsonPath('data.has_evidence', true)
        ->json('data.id');

    $path = LeaveRequest::findOrFail($id)->evidence_path;
    Storage::assertExists($path);
    expect($path)->toStartWith("leaves/{$this->intern->id}/");

    asLeaveIntern('GET', "/api/intern/leaves/{$id}/evidence")
        ->assertOk()
        ->assertDownload('lampiran-izin-2026-10-13.pdf');
});

it('does not keep the uploaded file when the leave is rejected', function () {
    leaveFor($this->intern, ['start_date' => '2026-10-13', 'end_date' => '2026-10-13']);

    applyLeave(['evidence' => UploadedFile::fake()->create('surat.pdf', 100, 'application/pdf')])->assertUnprocessable();

    expect(Storage::allFiles())->toBe([]);
});

it('lists the intern’s leaves by date, newest first, with the decider and note', function () {
    $admin = User::factory()->admin()->create(['name' => 'Admin Sinta']);
    leaveFor($this->intern, [
        'type' => LeaveType::Urgent, 'start_date' => '2026-10-05', 'end_date' => '2026-10-05',
        'status' => RequestStatus::Approved, 'decided_by' => $admin->id, 'decision_note' => 'Ada surat resmi.',
    ]);
    leaveFor($this->intern, ['start_date' => '2026-10-13', 'end_date' => '2026-10-14']);
    leaveFor($this->intern, ['start_date' => '2026-09-28', 'end_date' => '2026-09-29', 'status' => RequestStatus::Rejected, 'decided_by' => $this->mentor->id]);
    leaveFor(User::factory()->intern()->create(), ['start_date' => '2026-10-20', 'end_date' => '2026-10-20']);

    $response = asLeaveIntern('GET', '/api/intern/leaves')->assertOk();

    expect(array_column($response->json('data'), 'start_date'))->toBe(['2026-10-13', '2026-10-05', '2026-09-28'])
        ->and($response->json('data.1.decided_by'))->toBe(['name' => 'Admin Sinta', 'role' => 'admin'])
        ->and($response->json('data.1.decision_note'))->toBe('Ada surat resmi.')
        ->and($response->json('data.1.can_cancel'))->toBeFalse();

    expect(array_column(asLeaveIntern('GET', '/api/intern/leaves?status=pending')->json('data'), 'start_date'))
        ->toBe(['2026-10-13']);
});

it('cancels a pending leave and notifies the mentor', function () {
    $id = applyLeave()->json('data.id');

    asLeaveIntern('POST', "/api/intern/leaves/{$id}/cancel")
        ->assertOk()
        ->assertJsonPath('message', 'Pengajuan izin dibatalkan.')
        ->assertJsonPath('data.status', 'cancelled')
        ->assertJsonPath('data.can_cancel', false);

    $notification = Notification::query()->latest('id')->first();
    expect($notification->text)->toBe('Andi P. membatalkan pengajuan izin 13-14 Okt.')
        ->and($notification->link_path)->toBe('/izin')
        ->and($notification->link_params)->toBeNull();
});

it('cannot cancel a leave that was decided or already cancelled', function () {
    $decided = leaveFor($this->intern, ['status' => RequestStatus::Approved, 'decided_by' => $this->mentor->id, 'decision_note' => 'Semoga lekas sembuh.']);
    $cancelled = leaveFor($this->intern, ['start_date' => '2026-10-20', 'end_date' => '2026-10-20', 'status' => RequestStatus::Cancelled]);

    asLeaveIntern('POST', "/api/intern/leaves/{$decided->id}/cancel")
        ->assertUnprocessable()
        ->assertExactJson(['message' => 'Izin ini sudah diproses oleh Sari Wijaya.', 'reason' => 'already_processed']);

    asLeaveIntern('POST', "/api/intern/leaves/{$cancelled->id}/cancel")
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Pengajuan izin ini sudah dibatalkan.');

    expect($decided->refresh()->status)->toBe(RequestStatus::Approved)
        ->and(Notification::count())->toBe(0);
});

it('hides other interns’ leaves', function () {
    $other = leaveFor(User::factory()->intern()->create(), ['evidence_path' => 'leaves/99/x.pdf']);

    asLeaveIntern('GET', "/api/intern/leaves/{$other->id}")
        ->assertForbidden()
        ->assertJsonPath('message', 'Anda tidak memiliki akses ke izin ini.');
    asLeaveIntern('POST', "/api/intern/leaves/{$other->id}/cancel")->assertForbidden();
    asLeaveIntern('GET', "/api/intern/leaves/{$other->id}/evidence")->assertForbidden();

    expect($other->refresh()->status)->toBe(RequestStatus::Pending);
});

it('rejects mentors and admins', function (string $role) {
    $user = User::factory()->{$role}()->create();

    $this->getJson('/api/intern/leaves', ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken])
        ->assertForbidden();
})->with(['mentor', 'admin']);

it('rejects requests without a token', function () {
    $this->getJson('/api/intern/leaves')->assertUnauthorized();
    $this->postJson('/api/intern/leaves', [])->assertUnauthorized();
});
