<?php

use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\Holiday;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Sinta Admin']);
    $this->mentor = User::factory()->mentor()->create();
});

function settingsRequest(User $user, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

function settingsIntern(User $mentor, string $name, array $profile = [], array $attributes = []): User
{
    return User::factory()->intern([
        'mentor_id' => $mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
        ...$profile,
    ])->create(['name' => $name, ...$attributes]);
}

function dayStatus(User $intern, string $date): ?string
{
    return settingsRequest(test()->admin, 'GET', "/api/admin/users/{$intern->id}/attendance/days/{$date}")->json('data.status');
}

describe('kalender libur', function () {
    it('lists additional holidays by date', function () {
        $later = Holiday::factory()->create(['date' => '2026-12-25', 'name' => 'Hari Natal']);
        $earlier = Holiday::factory()->create(['date' => '2026-08-17', 'name' => 'Hari Kemerdekaan']);

        settingsRequest($this->admin, 'GET', '/api/admin/holidays')
            ->assertOk()
            ->assertExactJson(['data' => [
                ['id' => $earlier->id, 'date' => '2026-08-17', 'name' => 'Hari Kemerdekaan', 'is_past' => true],
                ['id' => $later->id, 'date' => '2026-12-25', 'name' => 'Hari Natal', 'is_past' => false],
            ]]);
    });

    it('saves a holiday that has not passed right away', function (string $date) {
        settingsRequest($this->admin, 'POST', '/api/admin/holidays', ['date' => $date, 'name' => ' Cuti Bersama '])
            ->assertCreated()
            ->assertJsonPath('message', 'Perubahan tersimpan.')
            ->assertJsonPath('data.name', 'Cuti Bersama');

        expect(AuditLog::sole()->only(['action', 'detail']))->toBe([
            'action' => 'Kalender dan jam kerja',
            'detail' => 'Tambah libur "Cuti Bersama".',
        ]);
    })->with(['2026-10-16', '2026-10-12']);

    it('asks to confirm a past date with the number of interns affected', function () {
        settingsIntern($this->mentor, 'Rina Wulandari');
        settingsIntern($this->mentor, 'Dinonaktifkan', attributes: ['is_active' => false]);
        settingsIntern($this->mentor, 'Belum Mulai', ['start_date' => '2026-10-05']);
        settingsIntern($this->mentor, 'Dihapus')->delete();

        settingsRequest($this->admin, 'POST', '/api/admin/holidays', ['date' => '2026-10-02', 'name' => 'Libur Daerah'])
            ->assertUnprocessable()
            ->assertExactJson(['message' => 'Tanggal ini sudah lewat.', 'reason' => 'confirm_recalculate', 'affected' => 2]);

        expect(Holiday::query()->count())->toBe(0);
    });

    it('recalculates attendance of a past date after confirmation and logs the count', function () {
        $rina = settingsIntern($this->mentor, 'Rina Wulandari');
        $budi = settingsIntern($this->mentor, 'Budi Kurniawan');
        Attendance::factory()->for($budi, 'intern')->create(['date' => '2026-10-02']);

        expect(dayStatus($rina, '2026-10-02'))->toBe('absent')
            ->and(dayStatus($budi, '2026-10-02'))->toBe('present');

        settingsRequest($this->admin, 'POST', '/api/admin/holidays', ['date' => '2026-10-02', 'name' => 'Libur Daerah', 'confirm' => true])
            ->assertCreated()
            ->assertJsonPath('data.is_past', true);

        expect(dayStatus($rina, '2026-10-02'))->toBe('holiday')
            ->and(dayStatus($budi, '2026-10-02'))->toBe('holiday')
            ->and(AuditLog::sole()->only(['object', 'detail']))->toBe([
                'object' => '2 Okt 2026',
                'detail' => 'Tambah libur "Libur Daerah". 2 absensi dihitung ulang.',
            ]);
    });

    it('validates the holiday form', function (array $data, string $message) {
        Holiday::factory()->create(['date' => '2026-10-16']);

        settingsRequest($this->admin, 'POST', '/api/admin/holidays', ['date' => '2026-10-15', 'name' => 'Libur', ...$data])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date' => $message]);
    })->with([
        'tanpa tanggal' => [['date' => ''], 'Tanggal dan nama libur wajib diisi.'],
        'sabtu' => [['date' => '2026-10-17'], 'Sabtu dan Minggu sudah libur otomatis.'],
        'sudah libur' => [['date' => '2026-10-16'], 'Tanggal ini sudah menjadi hari libur.'],
    ]);

    it('requires a name', function () {
        settingsRequest($this->admin, 'POST', '/api/admin/holidays', ['date' => '2026-10-15', 'name' => '  '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name' => 'Tanggal dan nama libur wajib diisi.']);
    });

    it('renames a past holiday without recalculating', function () {
        $holiday = Holiday::factory()->create(['date' => '2026-10-02', 'name' => 'Libur Daerah']);
        settingsIntern($this->mentor, 'Rina Wulandari');

        settingsRequest($this->admin, 'PUT', "/api/admin/holidays/{$holiday->id}", ['date' => '2026-10-02', 'name' => 'Cuti Bersama'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Cuti Bersama');

        expect(AuditLog::sole()->detail)->toBe('Ubah libur "Cuti Bersama".');
    });

    it('asks to confirm moving a holiday away from a past date, counting both dates', function () {
        $holiday = Holiday::factory()->create(['date' => '2026-10-02', 'name' => 'Libur Daerah']);
        $rina = settingsIntern($this->mentor, 'Rina Wulandari');

        settingsRequest($this->admin, 'PUT', "/api/admin/holidays/{$holiday->id}", ['date' => '2026-10-16', 'name' => 'Libur Daerah'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'confirm_recalculate')
            ->assertJsonPath('affected', 1);

        settingsRequest($this->admin, 'PUT', "/api/admin/holidays/{$holiday->id}", ['date' => '2026-10-16', 'name' => 'Libur Daerah', 'confirm' => true])
            ->assertOk()
            ->assertJsonPath('data.date', '2026-10-16');

        expect(dayStatus($rina, '2026-10-02'))->toBe('absent')
            ->and(AuditLog::sole()->only(['object', 'detail']))->toBe([
                'object' => '16 Okt 2026',
                'detail' => 'Ubah libur "Libur Daerah" (sebelumnya 2 Okt 2026). 1 absensi dihitung ulang.',
            ]);
    });

    it('rejects moving a holiday onto another holiday', function () {
        $holiday = Holiday::factory()->create(['date' => '2026-10-15']);
        Holiday::factory()->create(['date' => '2026-10-16']);

        settingsRequest($this->admin, 'PUT', "/api/admin/holidays/{$holiday->id}", ['date' => '2026-10-16', 'name' => 'Libur'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date' => 'Tanggal ini sudah menjadi hari libur.']);
    });

    it('turns a deleted past holiday back into a working day', function () {
        $holiday = Holiday::factory()->create(['date' => '2026-10-02', 'name' => 'Libur Daerah']);
        $rina = settingsIntern($this->mentor, 'Rina Wulandari');
        expect(dayStatus($rina, '2026-10-02'))->toBe('holiday');

        settingsRequest($this->admin, 'DELETE', "/api/admin/holidays/{$holiday->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Perubahan tersimpan.');

        expect(Holiday::query()->count())->toBe(0)
            ->and(dayStatus($rina, '2026-10-02'))->toBe('absent')
            ->and(AuditLog::sole()->only(['object', 'detail']))->toBe([
                'object' => '2 Okt 2026',
                'detail' => 'Hapus libur "Libur Daerah". 1 absensi dihitung ulang.',
            ]);
    });

    it('deletes an upcoming holiday without a recount', function () {
        $holiday = Holiday::factory()->create(['date' => '2026-12-25', 'name' => 'Hari Natal']);

        settingsRequest($this->admin, 'DELETE', "/api/admin/holidays/{$holiday->id}")->assertOk();

        expect(AuditLog::sole()->detail)->toBe('Hapus libur "Hari Natal".');
    });
});

it('rejects interns and mentors from the settings', function (string $role) {
    $actor = User::factory()->{$role}()->create();
    $holiday = Holiday::factory()->create(['date' => '2026-12-25']);

    settingsRequest($actor, 'GET', '/api/admin/holidays')->assertForbidden();
    settingsRequest($actor, 'DELETE', "/api/admin/holidays/{$holiday->id}")->assertForbidden();
})->with(['intern', 'mentor']);
