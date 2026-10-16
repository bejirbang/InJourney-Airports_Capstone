<?php

use App\Enums\RequestStatus;
use App\Models\Attendance;
use App\Models\AttendanceCorrection;
use App\Models\Holiday;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

// Senin, 12 Oktober 2026. Magang 1 Sep sampai 31 Des 2026.
// Jumat 9 Okt: clock in 08:02 tanpa clock out (Lupa Clock Out).
beforeEach(function () {
    Storage::fake();
    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));

    $this->intern = User::factory()->intern([
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create(['name' => 'Rina Wulandari']);
    $this->token = $this->intern->createToken('api')->plainTextToken;
    Attendance::factory()->clockedIn()->for($this->intern, 'intern')->create([
        'date' => '2026-10-09',
        'clock_in_at' => '08:02:00',
    ]);
});

function submitCorrection(array $overrides = [])
{
    return test()->post('/api/intern/attendance-corrections', [
        'date' => '2026-10-09',
        'clock_in' => '08:02',
        'clock_out' => '17:00',
        'reason' => 'Lupa clock out karena listrik padam.',
        ...$overrides,
    ], ['Authorization' => 'Bearer '.test()->token, 'Accept' => 'application/json']);
}

function asIntern(string $method, string $uri)
{
    return test()->json($method, $uri, [], ['Authorization' => 'Bearer '.test()->token]);
}

it('submits a pending correction with the recorded times as comparison', function () {
    submitCorrection()
        ->assertCreated()
        ->assertJsonPath('message', 'Permintaan koreksi terkirim. Menunggu admin.')
        ->assertJsonPath('data.date', '2026-10-09')
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.submitted_at', '2026-10-12T10:00:00+07:00')
        ->assertJsonPath('data.recorded', ['clock_in' => '08:02', 'clock_out' => null])
        ->assertJsonPath('data.requested', ['clock_in' => '08:02', 'clock_out' => '17:00'])
        ->assertJsonPath('data.reason', 'Lupa clock out karena listrik padam.')
        ->assertJsonPath('data.has_evidence', false)
        ->assertJsonPath('data.final', null)
        ->assertJsonPath('data.can_cancel', true);

    // Absensi belum berubah sampai admin menyetujui.
    expect(Attendance::sole()->clock_out_at)->toBeNull();
});

it('notifies every active admin', function () {
    $admin = User::factory()->admin()->create();
    User::factory()->admin()->inactive()->create();
    User::factory()->mentor()->create();

    $id = submitCorrection()->json('data.id');

    $notification = Notification::sole();
    expect($notification->user_id)->toBe($admin->id)
        ->and($notification->text)->toBe('Rina W. mengajukan koreksi absensi 9 Okt.')
        ->and($notification->link_path)->toBe('/koreksi')
        ->and($notification->link_params)->toBe(['open' => $id]);
});

it('allows a correction for a day without attendance and for today', function (string $date) {
    submitCorrection(['date' => $date])
        ->assertCreated()
        ->assertJsonPath('data.recorded', ['clock_in' => null, 'clock_out' => null]);
})->with(['2026-10-08', '2026-10-12']);

it('stores optional evidence privately and lets the intern download it', function () {
    $id = submitCorrection(['evidence' => UploadedFile::fake()->create('surat.pdf', 500, 'application/pdf')])
        ->assertCreated()
        ->assertJsonPath('data.has_evidence', true)
        ->json('data.id');

    $path = AttendanceCorrection::findOrFail($id)->evidence_path;
    Storage::assertExists($path);
    expect($path)->toStartWith("attendance-corrections/{$this->intern->id}/");

    asIntern('GET', "/api/intern/attendance-corrections/{$id}/evidence")
        ->assertOk()
        ->assertDownload('bukti-koreksi-2026-10-09.pdf');
});

it('rejects evidence over 2 MB or of a type that is not allowed', function (UploadedFile $file, string $message) {
    submitCorrection(['evidence' => $file])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['evidence' => $message]);

    expect(AttendanceCorrection::count())->toBe(0);
})->with([
    'lebih dari 2 MB' => [fn () => UploadedFile::fake()->create('surat.pdf', 2049, 'application/pdf'), 'Ukuran file maksimal 2 MB.'],
    'gambar' => [fn () => UploadedFile::fake()->image('foto.jpg'), 'Jenis file tidak diizinkan. Gunakan PDF, Word, Excel, atau PowerPoint.'],
]);

it('rejects dates that are not past working days in the internship period', function (string $date) {
    Holiday::factory()->create(['date' => '2026-10-07', 'name' => 'Libur Nasional']);

    submitCorrection(['date' => $date])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'date' => 'Pilih hari kerja yang sudah lewat atau hari ini, dalam periode magang.',
        ]);
})->with([
    'akhir pekan' => '2026-10-10',
    'hari libur' => '2026-10-07',
    'besok' => '2026-10-13',
    'sebelum magang' => '2026-08-31',
    'bukan tanggal' => '9 Okt 2026',
]);

it('allows only one pending correction per date', function () {
    submitCorrection()->assertCreated();

    submitCorrection(['clock_out' => '17:30'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['date' => 'Sudah ada permintaan koreksi untuk tanggal ini.']);

    expect(AttendanceCorrection::count())->toBe(1);
});

it('allows a new request after the previous one was decided or cancelled', function (RequestStatus $status) {
    AttendanceCorrection::factory()->for($this->intern, 'intern')
        ->decided($status, User::factory()->admin()->create())
        ->create(['date' => '2026-10-09']);

    submitCorrection()->assertCreated();
})->with([RequestStatus::Approved, RequestStatus::Rejected, RequestStatus::Cancelled]);

it('validates times and reason with the documented messages', function (array $payload, string $field, string $message) {
    submitCorrection($payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);
})->with([
    'tanggal kosong' => [['date' => ''], 'date', 'Pilih tanggal absensi.'],
    'clock out sebelum clock in' => [['clock_in' => '17:00', 'clock_out' => '08:00'], 'clock_out', 'Jam clock out harus setelah jam clock in.'],
    'clock out sama dengan clock in' => [['clock_in' => '08:00', 'clock_out' => '08:00'], 'clock_out', 'Jam clock out harus setelah jam clock in.'],
    'jam kosong' => [['clock_out' => ''], 'clock_out', 'Isi jam clock in dan clock out yang benar.'],
    'format jam' => [['clock_in' => '8 pagi'], 'clock_in', 'Format jam tidak valid. Gunakan JJ:MM.'],
    'alasan kosong' => [['reason' => '   '], 'reason', 'Alasan wajib diisi.'],
]);

it('lists the intern’s own corrections, newest first, with the admin note', function () {
    $admin = User::factory()->admin()->create(['name' => 'Sinta Dewi']);
    AttendanceCorrection::factory()->for($this->intern, 'intern')
        ->decided(RequestStatus::Approved, $admin, 'Sesuai bukti.')
        ->create(['date' => '2026-10-02', 'created_at' => '2026-10-03 08:05:00']);
    AttendanceCorrection::factory()->for($this->intern, 'intern')
        ->create(['date' => '2026-10-09', 'created_at' => '2026-10-10 09:12:00']);
    AttendanceCorrection::factory()->create(); // milik intern lain

    $response = asIntern('GET', '/api/intern/attendance-corrections')->assertOk();

    expect(array_column($response->json('data'), 'date'))->toBe(['2026-10-09', '2026-10-02'])
        ->and($response->json('data.1.status'))->toBe('approved')
        ->and($response->json('data.1.decision_note'))->toBe('Sesuai bukti.')
        ->and($response->json('data.1.decided_by'))->toBe('Sinta Dewi')
        ->and($response->json('data.1.final'))->toBe(['clock_in' => '08:00', 'clock_out' => '17:00'])
        ->and($response->json('data.1.can_cancel'))->toBeFalse();
});

it('cancels a pending correction', function () {
    $id = submitCorrection()->json('data.id');

    asIntern('POST', "/api/intern/attendance-corrections/{$id}/cancel")
        ->assertOk()
        ->assertJsonPath('message', 'Permintaan koreksi dibatalkan.')
        ->assertJsonPath('data.status', 'cancelled')
        ->assertJsonPath('data.can_cancel', false);
});

it('cannot cancel a correction that was already decided or cancelled', function () {
    $admin = User::factory()->admin()->create(['name' => 'Sinta Dewi']);
    $decided = AttendanceCorrection::factory()->for($this->intern, 'intern')
        ->decided(RequestStatus::Rejected, $admin, 'Tidak ada bukti.')
        ->create(['date' => '2026-10-02']);
    $cancelled = AttendanceCorrection::factory()->for($this->intern, 'intern')
        ->create(['date' => '2026-10-05', 'status' => RequestStatus::Cancelled]);

    asIntern('POST', "/api/intern/attendance-corrections/{$decided->id}/cancel")
        ->assertUnprocessable()
        ->assertExactJson(['message' => 'Data ini sudah diproses oleh Sinta Dewi.', 'reason' => 'already_processed']);

    asIntern('POST', "/api/intern/attendance-corrections/{$cancelled->id}/cancel")
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Permintaan ini sudah dibatalkan.');

    expect($decided->refresh()->status)->toBe(RequestStatus::Rejected);
});

it('hides other interns’ corrections', function () {
    $other = AttendanceCorrection::factory()->create(['evidence_path' => 'attendance-corrections/99/x.pdf']);

    asIntern('GET', "/api/intern/attendance-corrections/{$other->id}")->assertForbidden();
    asIntern('POST', "/api/intern/attendance-corrections/{$other->id}/cancel")->assertForbidden();
    asIntern('GET', "/api/intern/attendance-corrections/{$other->id}/evidence")->assertForbidden();

    expect($other->refresh()->status)->toBe(RequestStatus::Pending);
});

it('marks a date with a pending correction in the attendance history', function () {
    submitCorrection()->assertCreated();

    $day = collect(asIntern('GET', '/api/intern/attendance')->json('data.days'))->firstWhere('date', '2026-10-09');

    expect($day['has_pending_correction'])->toBeTrue()
        ->and($day['can_request_correction'])->toBeFalse();
});

it('rejects mentors and admins', function (string $role) {
    $user = User::factory()->{$role}()->create();

    $this->getJson('/api/intern/attendance-corrections', [
        'Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken,
    ])->assertForbidden();
})->with(['mentor', 'admin']);

it('rejects requests without a token', function () {
    $this->getJson('/api/intern/attendance-corrections')->assertUnauthorized();
    $this->postJson('/api/intern/attendance-corrections', [])->assertUnauthorized();
});
