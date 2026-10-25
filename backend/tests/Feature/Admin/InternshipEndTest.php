<?php

use App\Models\AuditLog;
use App\Models\LeaveRequest;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 07:00:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Dedi Admin']);
    $this->mentor = User::factory()->mentor()->create(['name' => 'Budi Santoso']);
    $this->rina = endingIntern($this->mentor, 'Rina Wulandari', '2026-10-17');
});

function internshipRequest(User $user, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

function endingIntern(User $mentor, string $name, string $endDate, array $profile = [], array $attributes = []): User
{
    return User::factory()->intern([
        'mentor_id' => $mentor->id,
        'start_date' => '2026-07-01',
        'end_date' => $endDate,
        ...$profile,
    ])->create(['name' => $name, ...$attributes]);
}

function extendInternship(User $intern, ?string $endDate): TestResponse
{
    return internshipRequest(test()->admin, 'POST', "/api/admin/users/{$intern->id}/extend", ['end_date' => $endDate]);
}

describe('perpanjang magang', function () {
    it('moves the end date, takes the intern off the reminder list, and logs it', function () {
        extendInternship($this->rina, '2026-12-31')
            ->assertOk()
            ->assertJsonPath('message', 'Perubahan tersimpan.')
            ->assertJsonPath('data.end_date', '2026-12-31')
            ->assertJsonPath('data.status', 'active');

        expect(AuditLog::sole()->only(['admin_name', 'action', 'object', 'detail']))->toBe([
            'admin_name' => 'Dedi Admin',
            'action' => 'Akun',
            'object' => 'Rina Wulandari',
            'detail' => 'Perpanjang magang dari 17 Okt 2026 ke 31 Des 2026.',
        ]);

        internshipRequest($this->admin, 'GET', '/api/admin/dashboard')->assertJsonPath('data.ending_internships.total', 0);
    });

    it('resets the leave quota from the day of the extension and the presentation reminder', function () {
        foreach (['2026-08-03', '2026-09-01', '2026-10-05'] as $date) {
            LeaveRequest::factory()->for($this->rina, 'intern')->approved()->create(['start_date' => $date, 'end_date' => $date, 'created_at' => "{$date} 08:00:00"]);
        }
        $this->rina->internProfile->update(['presentation_reminded_at' => '2026-10-10 07:00:00']);

        internshipRequest($this->admin, 'GET', "/api/admin/users/{$this->rina->id}")->assertJsonPath('data.leave_quota.exhausted', true);

        extendInternship($this->rina, '2026-12-31')->assertOk();

        $profile = $this->rina->internProfile->refresh();
        expect($profile->leave_quota_since->toDateString())->toBe('2026-10-12')
            ->and($profile->presentation_reminded_at)->toBeNull();

        internshipRequest($this->admin, 'GET', "/api/admin/users/{$this->rina->id}")
            ->assertJsonPath('data.leave_quota', ['used' => 0, 'limit' => 3, 'remaining' => 3, 'exhausted' => false]);
    });

    it('requires a new end date after the current one', function (string $endDate) {
        extendInternship($this->rina, $endDate)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['end_date' => 'Tanggal baru harus setelah tanggal selesai saat ini.']);

        expect($this->rina->internProfile->refresh()->end_date->toDateString())->toBe('2026-10-17')
            ->and(AuditLog::query()->count())->toBe(0);
    })->with(['2026-10-17', '2026-10-16']);

    it('validates the date field', function (?string $endDate, string $message) {
        extendInternship($this->rina, $endDate)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['end_date' => $message]);
    })->with([
        [null, 'Tanggal selesai baru wajib diisi.'],
        ['17/12/2026', 'Format tanggal tidak valid.'],
    ]);

    it('reactivates an intern whose internship has already ended', function () {
        $ended = endingIntern($this->mentor, 'Sudah Selesai', '2026-10-09');

        extendInternship($ended, '2026-11-30')
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        expect(AuditLog::sole()->detail)->toBe('Perpanjang magang dari 9 Okt 2026 ke 30 Nov 2026.');
    });

    it('reactivates a deactivated intern, the way Aktifkan asks for', function () {
        $intern = endingIntern($this->mentor, 'Dinonaktifkan', '2026-10-09', attributes: ['is_active' => false]);

        internshipRequest($this->admin, 'POST', "/api/admin/users/{$intern->id}/activate")
            ->assertJsonPath('reason', 'internship_ended');

        extendInternship($intern, '2026-11-30')
            ->assertOk()
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.status', 'active');

        expect(AuditLog::sole()->detail)->toBe('Perpanjang magang dari 9 Okt 2026 ke 30 Nov 2026. Akun diaktifkan kembali.');
    });

    it('rejects a new end date before today, which would not reactivate the account', function () {
        $ended = endingIntern($this->mentor, 'Sudah Selesai', '2026-10-05');

        extendInternship($ended, '2026-10-09')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['end_date' => 'Tanggal selesai baru tidak boleh sebelum hari ini.']);

        extendInternship($ended, '2026-10-12')->assertOk();
    });

    it('rejects accounts that are not interns', function () {
        extendInternship($this->mentor, '2026-12-31')
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'not_intern')
            ->assertJsonPath('message', 'Akun ini bukan intern.');
    });
});

it('lists every internship ending within seven days for Lihat semua, nearest first', function () {
    foreach (['2026-10-19', '2026-10-13', '2026-10-15', '2026-10-14', '2026-10-16'] as $i => $end) {
        endingIntern($this->mentor, "Intern {$i}", $end);
    }
    $today = endingIntern($this->mentor, 'Doni Akbar', '2026-10-12');
    endingIntern($this->mentor, 'Delapan Hari', '2026-10-20');
    endingIntern($this->mentor, 'Dinonaktifkan', '2026-10-15', attributes: ['is_active' => false]);
    endingIntern($this->mentor, 'Belum Mulai', '2026-10-16', ['start_date' => '2026-10-13']);

    internshipRequest($this->admin, 'GET', '/api/admin/ending-internships')
        ->assertOk()
        ->assertJsonCount(7, 'data')
        ->assertJsonPath('data.*.end_date', ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-19'])
        ->assertJsonPath('data.0', [
            'intern' => ['id' => $today->id, 'name' => 'Doni Akbar', 'short_name' => 'Doni A.'],
            'end_date' => '2026-10-12',
            'ends_in_days' => 0,
            'mentor' => ['id' => $this->mentor->id, 'name' => 'Budi Santoso'],
        ]);

    internshipRequest($this->admin, 'GET', '/api/admin/dashboard')
        ->assertJsonPath('data.ending_internships.total', 7)
        ->assertJsonCount(5, 'data.ending_internships.items');
});

describe('pengingat akhir magang', function () {
    it('reminds every active admin once per end date', function () {
        $sinta = User::factory()->admin()->create();
        User::factory()->admin()->inactive()->create();
        endingIntern($this->mentor, 'Doni Akbar', '2026-10-19');
        endingIntern($this->mentor, 'Delapan Hari', '2026-10-20');

        $this->artisan('app:remind-ending-internships')->expectsOutput('2 pengingat akhir magang dikirim.')->assertSuccessful();

        expect(Notification::query()->where('user_id', $this->admin->id)->orderBy('id')->get(['text', 'link_path', 'link_params'])->toArray())->toBe([
            ['text' => 'Magang Rina W. berakhir dalam 5 hari.', 'link_path' => '/', 'link_params' => null],
            ['text' => 'Magang Doni A. berakhir dalam 7 hari.', 'link_path' => '/', 'link_params' => null],
        ])->and(Notification::query()->where('user_id', $sinta->id)->count())->toBe(2)
            ->and(Notification::query()->count())->toBe(4);

        $this->travelTo(Carbon::parse('2026-10-13 07:00:00'));
        $this->artisan('app:remind-ending-internships')->expectsOutput('1 pengingat akhir magang dikirim.')->assertSuccessful();

        expect(Notification::query()->latest('id')->value('text'))->toBe('Magang Delapan H. berakhir dalam 7 hari.');
    });

    it('says today on the last day', function () {
        endingIntern($this->mentor, 'Doni Akbar', '2026-10-12');
        $this->rina->internProfile->update(['end_date' => '2026-12-31']);

        $this->artisan('app:remind-ending-internships')->assertSuccessful();

        expect(Notification::query()->where('user_id', $this->admin->id)->value('text'))->toBe('Magang Doni A. berakhir hari ini.');
    });

    it('reminds again after the internship is extended to a date that comes near', function () {
        $this->artisan('app:remind-ending-internships')->expectsOutput('1 pengingat akhir magang dikirim.');

        extendInternship($this->rina, '2026-10-30')->assertOk();
        $this->artisan('app:remind-ending-internships')->expectsOutput('0 pengingat akhir magang dikirim.');

        $this->travelTo(Carbon::parse('2026-10-23 07:00:00'));
        $this->artisan('app:remind-ending-internships')->expectsOutput('1 pengingat akhir magang dikirim.');

        expect(Notification::query()->latest('id')->value('text'))->toBe('Magang Rina W. berakhir dalam 7 hari.');
    });

    it('skips deactivated interns and interns who have not started', function () {
        $this->rina->update(['is_active' => false]);
        endingIntern($this->mentor, 'Belum Mulai', '2026-10-16', ['start_date' => '2026-10-13']);

        $this->artisan('app:remind-ending-internships')->expectsOutput('0 pengingat akhir magang dikirim.');
    });
});

it('rejects interns and mentors from the internship end actions', function (string $role) {
    $actor = User::factory()->{$role}()->create();

    internshipRequest($actor, 'GET', '/api/admin/ending-internships')->assertForbidden();
    internshipRequest($actor, 'POST', "/api/admin/users/{$this->rina->id}/extend", ['end_date' => '2026-12-31'])->assertForbidden();
})->with(['intern', 'mentor']);
