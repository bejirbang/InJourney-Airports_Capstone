<?php

use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\Holiday;
use App\Models\Notification;
use App\Models\User;
use App\Models\Warning;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Admin Sinta']);
    $this->intern = User::factory()->intern([
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create(['name' => 'Andi Pratama']);
});

function warningRequest(User $admin, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$admin->createToken('api')->plainTextToken]);
}

it('lists interns with their warning count for the warning page', function () {
    $budi = User::factory()->intern()->create(['name' => 'Budi Kurniawan']);
    Warning::factory()->count(2)->create(['intern_id' => $this->intern->id, 'author_id' => $this->admin->id]);

    warningRequest($this->admin, 'GET', '/api/admin/warnings')
        ->assertOk()
        ->assertExactJson(['data' => [
            ['id' => $this->intern->id, 'name' => 'Andi Pratama', 'warnings' => 2],
            ['id' => $budi->id, 'name' => 'Budi Kurniawan', 'warnings' => 0],
        ]]);

    warningRequest($this->admin, 'GET', '/api/admin/warnings?q=budi')
        ->assertJsonPath('data.*.name', ['Budi Kurniawan']);
});

it('shows the notes newest first with this month late count', function () {
    Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-05', 'clock_in_at' => '08:20:00']);
    Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-06', 'clock_in_at' => '07:55:00']);
    Attendance::factory()->for($this->intern, 'intern')->clockedIn()->create(['date' => '2026-10-12', 'clock_in_at' => '08:25:00']);
    Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-09-30', 'clock_in_at' => '09:00:00']);

    $other = User::factory()->admin()->create(['name' => 'Admin Rudi']);
    $old = Warning::factory()->create(['intern_id' => $this->intern->id, 'author_id' => $other->id, 'body' => 'Tidak mengisi Daily Report.', 'created_at' => '2026-10-02 10:00:00']);
    $new = Warning::factory()->create(['intern_id' => $this->intern->id, 'author_id' => $this->admin->id, 'body' => 'Terlambat 3 kali.', 'created_at' => '2026-10-12 09:00:00']);

    warningRequest($this->admin, 'GET', "/api/admin/users/{$this->intern->id}/warnings")
        ->assertOk()
        ->assertJsonPath('data.late_this_month', 2)
        ->assertJsonPath('data.warnings.0.id', $new->id)
        ->assertJsonPath('data.warnings.0.author', ['id' => $this->admin->id, 'name' => 'Admin Sinta'])
        ->assertJsonPath('data.warnings.0.can_edit', true)
        ->assertJsonPath('data.warnings.1.id', $old->id)
        ->assertJsonPath('data.warnings.1.can_edit', false);
});

it('does not count a day that later became a holiday as late', function () {
    Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-05', 'clock_in_at' => '08:20:00']);
    Attendance::factory()->for($this->intern, 'intern')->create(['date' => '2026-10-07', 'clock_in_at' => '08:30:00']);
    Holiday::factory()->create(['date' => '2026-10-07', 'name' => 'Libur Daerah']);

    warningRequest($this->admin, 'GET', "/api/admin/users/{$this->intern->id}/warnings")
        ->assertJsonPath('data.late_this_month', 1);

    warningRequest($this->admin, 'GET', "/api/admin/users/{$this->intern->id}/attendance/days/2026-10-07")
        ->assertJsonPath('data.status', 'holiday')
        ->assertJsonPath('data.late_minutes', null);
});

it('shows who can read the notes and the leave quota in the summary', function () {
    $mentor = $this->intern->internProfile->mentor;

    warningRequest($this->admin, 'GET', "/api/admin/users/{$this->intern->id}/warnings")
        ->assertJsonPath('data.mentor', ['id' => $mentor->id, 'name' => $mentor->name])
        ->assertJsonPath('data.leave_quota.limit', 3)
        ->assertJsonPath('data.leave_quota.remaining', 3);
});

it('adds a note, notifies the intern and the mentor, and logs it', function () {
    $mentorId = $this->intern->internProfile->mentor_id;

    warningRequest($this->admin, 'POST', "/api/admin/users/{$this->intern->id}/warnings", ['body' => 'Terlambat clock in 3 kali dalam seminggu.'])
        ->assertCreated()
        ->assertJsonPath('message', 'Catatan tersimpan dan dikirim sebagai notifikasi ke intern dan mentor.')
        ->assertJsonPath('data.body', 'Terlambat clock in 3 kali dalam seminggu.')
        ->assertJsonPath('data.author.name', 'Admin Sinta')
        ->assertJsonPath('data.can_edit', true);

    expect(Notification::query()->orderBy('id')->get(['user_id', 'text', 'link_path', 'link_params'])->toArray())->toBe([
        ['user_id' => $this->intern->id, 'text' => 'Ada catatan baru dari admin.', 'link_path' => '/catatan', 'link_params' => null],
        ['user_id' => $mentorId, 'text' => 'Ada catatan baru untuk Andi P.', 'link_path' => '/intern-saya', 'link_params' => ['open' => $this->intern->id, 'tab' => 'catatan']],
    ]);

    $log = AuditLog::sole();
    expect($log->action)->toBe('Warning')
        ->and($log->object)->toBe('Andi Pratama')
        ->and($log->detail)->toBe('Tambah catatan warning.');
});

it('does not notify again when a note is edited', function () {
    $warning = Warning::factory()->create(['intern_id' => $this->intern->id, 'author_id' => $this->admin->id, 'created_at' => '2026-10-12 09:00:00']);

    warningRequest($this->admin, 'PUT', "/api/admin/warnings/{$warning->id}", ['body' => 'Diubah.'])->assertOk();

    expect(Notification::count())->toBe(0);
});

it('lets the intern and their mentor read the notes, newest first', function () {
    $mentor = $this->intern->internProfile->mentor;
    $old = Warning::factory()->create(['intern_id' => $this->intern->id, 'author_id' => $this->admin->id, 'body' => 'Logbook dua hari belum diisi.', 'created_at' => '2026-10-02 10:00:00']);
    $new = Warning::factory()->create(['intern_id' => $this->intern->id, 'author_id' => $this->admin->id, 'body' => 'Terlambat 3 kali.', 'created_at' => '2026-10-10 09:00:00']);
    Warning::factory()->create();

    $expected = [
        ['id' => $new->id, 'body' => 'Terlambat 3 kali.', 'author' => 'Admin Sinta', 'created_at' => '2026-10-10T09:00:00+07:00', 'updated_at' => $new->updated_at?->toIso8601String()],
        ['id' => $old->id, 'body' => 'Logbook dua hari belum diisi.', 'author' => 'Admin Sinta', 'created_at' => '2026-10-02T10:00:00+07:00', 'updated_at' => $old->updated_at?->toIso8601String()],
    ];

    warningRequest($this->intern, 'GET', '/api/intern/warnings')->assertOk()->assertExactJson(['data' => $expected]);
    warningRequest($mentor, 'GET', "/api/mentor/interns/{$this->intern->id}/warnings")->assertOk()->assertExactJson(['data' => $expected]);
    warningRequest(User::factory()->mentor()->create(), 'GET', "/api/mentor/interns/{$this->intern->id}/warnings")->assertForbidden();
});

it('shows an empty list to an intern without notes', function () {
    warningRequest($this->intern, 'GET', '/api/intern/warnings')->assertOk()->assertExactJson(['data' => []]);
});

it('requires the note text, up to 2000 characters', function (string $body, string $message) {
    warningRequest($this->admin, 'POST', "/api/admin/users/{$this->intern->id}/warnings", ['body' => $body])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['body' => $message]);
})->with([
    'kosong' => ['   ', 'Catatan wajib diisi.'],
    'terlalu panjang' => [str_repeat('a', 2001), 'Catatan maksimal 2000 karakter.'],
]);

it('does not log saving a note without changes', function () {
    $warning = Warning::factory()->create(['intern_id' => $this->intern->id, 'author_id' => $this->admin->id, 'body' => 'Sama.', 'created_at' => '2026-10-12 09:00:00']);

    warningRequest($this->admin, 'PUT', "/api/admin/warnings/{$warning->id}", ['body' => 'Sama.'])->assertOk();

    expect(AuditLog::query()->count())->toBe(0);
});

it('returns 404 for a note of a deleted intern', function () {
    $warning = Warning::factory()->create(['intern_id' => $this->intern->id, 'author_id' => $this->admin->id, 'created_at' => '2026-10-12 09:00:00']);
    $this->intern->delete();

    warningRequest($this->admin, 'PUT', "/api/admin/warnings/{$warning->id}", ['body' => 'Diubah.'])->assertNotFound();
});

it('lets the author edit a note within 24 hours', function () {
    $warning = Warning::factory()->create(['intern_id' => $this->intern->id, 'author_id' => $this->admin->id, 'created_at' => '2026-10-11 14:39:00']);

    warningRequest($this->admin, 'PUT', "/api/admin/warnings/{$warning->id}", ['body' => 'Sudah ditegur lisan.'])
        ->assertOk()
        ->assertJsonPath('message', 'Perubahan tersimpan.')
        ->assertJsonPath('data.body', 'Sudah ditegur lisan.');

    expect(AuditLog::sole()->detail)->toBe('Ubah catatan warning.');
});

it('locks a note after 24 hours or for another admin', function () {
    $old = Warning::factory()->create(['intern_id' => $this->intern->id, 'author_id' => $this->admin->id, 'created_at' => '2026-10-11 14:38:00']);
    $others = Warning::factory()->create(['intern_id' => $this->intern->id, 'body' => 'Asli.']);

    foreach ([$old, $others] as $warning) {
        warningRequest($this->admin, 'PUT', "/api/admin/warnings/{$warning->id}", ['body' => 'Diubah.'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'locked')
            ->assertJsonPath('message', 'Catatan hanya bisa diubah pembuatnya dalam 24 jam.');
    }

    expect($others->refresh()->body)->toBe('Asli.')
        ->and(AuditLog::query()->count())->toBe(0);
});

it('hides warnings from interns and mentors', function (string $role) {
    $actor = User::factory()->{$role}()->create();

    warningRequest($actor, 'GET', '/api/admin/warnings')->assertForbidden();
    warningRequest($actor, 'GET', "/api/admin/users/{$this->intern->id}/warnings")->assertForbidden();
})->with(['intern', 'mentor']);
