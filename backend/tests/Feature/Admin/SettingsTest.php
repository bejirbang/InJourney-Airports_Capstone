<?php

use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\Holiday;
use App\Models\User;
use App\Models\WorkHourSetting;
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

describe('jam kerja', function () {
    it('shows nothing before the admin sets work hours, with the fixed 23:59 cutoff', function () {
        settingsRequest($this->admin, 'GET', '/api/admin/settings/work-hours')
            ->assertOk()
            ->assertExactJson(['data' => ['current' => null, 'cutoff' => '23:59', 'history' => []]]);
    });

    it('schedules new work hours from the effective date and keeps the history', function () {
        WorkHourSetting::factory()->create(['effective_from' => '2026-01-01']);

        settingsRequest($this->admin, 'POST', '/api/admin/settings/work-hours', [
            'start_time' => '08:30', 'end_time' => '17:30', 'effective_from' => '2026-10-13',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Perubahan tersimpan. Data absensi sebelumnya tidak berubah.')
            ->assertJsonPath('data.current', ['effective_from' => '2026-01-01', 'start' => '08:00', 'end' => '17:00'])
            ->assertJsonPath('data.history', [
                ['effective_from' => '2026-10-13', 'start' => '08:30', 'end' => '17:30', 'state' => 'upcoming'],
                ['effective_from' => '2026-01-01', 'start' => '08:00', 'end' => '17:00', 'state' => 'current'],
            ]);

        expect(AuditLog::sole()->only(['admin_name', 'action', 'object', 'detail']))->toBe([
            'admin_name' => 'Sinta Admin',
            'action' => 'Kalender dan jam kerja',
            'object' => 'Jam kerja',
            'detail' => 'Ubah jam kerja menjadi 08:30 - 17:30 mulai 13 Okt 2026.',
        ]);
    });

    it('does not change attendance before the effective date', function () {
        WorkHourSetting::factory()->create(['effective_from' => '2026-01-01']);
        $rina = settingsIntern($this->mentor, 'Rina Wulandari');
        Attendance::factory()->for($rina, 'intern')->create(['date' => '2026-10-09', 'clock_in_at' => '08:10:00']);

        settingsRequest($this->admin, 'POST', '/api/admin/settings/work-hours', [
            'start_time' => '08:30', 'end_time' => '17:00', 'effective_from' => '2026-10-12',
        ])->assertOk();

        settingsRequest($this->admin, 'GET', "/api/admin/users/{$rina->id}/attendance/days/2026-10-09")
            ->assertJsonPath('data.late_minutes', 10);
    });

    it('replaces the setting of the same effective date instead of adding one', function () {
        WorkHourSetting::factory()->create(['effective_from' => '2026-10-13']);

        settingsRequest($this->admin, 'POST', '/api/admin/settings/work-hours', [
            'start_time' => '07:30', 'end_time' => '16:30', 'effective_from' => '2026-10-13',
        ])->assertOk();

        expect(WorkHourSetting::sole()->toHours())->toBe(['start' => '07:30', 'end' => '16:30']);
    });

    it('validates the form', function (array $data, string $field, string $message) {
        settingsRequest($this->admin, 'POST', '/api/admin/settings/work-hours', [
            'start_time' => '08:00', 'end_time' => '17:00', 'effective_from' => '2026-10-13', ...$data,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field => $message]);

        expect(WorkHourSetting::query()->count())->toBe(0);
    })->with([
        'pulang sebelum masuk' => [['end_time' => '07:00'], 'end_time', 'Jam pulang harus setelah jam masuk.'],
        'pulang sama dengan masuk' => [['end_time' => '08:00'], 'end_time', 'Jam pulang harus setelah jam masuk.'],
        'tanggal lampau' => [['effective_from' => '2026-10-11'], 'effective_from', 'Tanggal berlaku tidak boleh sebelum hari ini.'],
        'format jam' => [['start_time' => '8 pagi'], 'start_time', 'Format jam tidak valid. Gunakan JJ:MM.'],
    ]);

    it('lets today be the effective date', function () {
        settingsRequest($this->admin, 'POST', '/api/admin/settings/work-hours', [
            'start_time' => '08:00', 'end_time' => '17:00', 'effective_from' => '2026-10-12',
        ])
            ->assertOk()
            ->assertJsonPath('data.current.effective_from', '2026-10-12');
    });
});

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

    settingsRequest($actor, 'GET', '/api/admin/settings/work-hours')->assertForbidden();
    settingsRequest($actor, 'POST', '/api/admin/settings/work-hours', ['start_time' => '08:00', 'end_time' => '17:00', 'effective_from' => '2026-10-13'])->assertForbidden();
    settingsRequest($actor, 'GET', '/api/admin/holidays')->assertForbidden();
    settingsRequest($actor, 'DELETE', "/api/admin/holidays/{$holiday->id}")->assertForbidden();
})->with(['intern', 'mentor']);
