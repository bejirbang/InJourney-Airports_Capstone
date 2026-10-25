<?php

use App\Models\Airport;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\Office;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 08:02:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Sinta Admin']);
    $this->office = Office::factory()->create(['name' => 'Kantor Pusat Terminal 3']);
});

function officeRequest(User $user, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

function officeForm(array $overrides = []): array
{
    return [
        'airport_id' => test()->office->airport_id,
        'name' => 'Kantor Cabang Terminal 1',
        'latitude' => -6.1275,
        'longitude' => 106.6537,
        'clock_in_radius_meters' => 150,
        'clock_out_radius_meters' => 150,
        ...$overrides,
    ];
}

it('lists every office by name with its status and the active count', function () {
    $inactive = Office::factory()->inactive()->for($this->office->airport)->create(['name' => 'Kantor Cabang Terminal 1']);

    officeRequest($this->admin, 'GET', '/api/admin/offices')
        ->assertOk()
        ->assertJsonPath('data.*.name', ['Kantor Cabang Terminal 1', 'Kantor Pusat Terminal 3'])
        ->assertJsonPath('data.0', [
            'id' => $inactive->id,
            'airport_id' => $this->office->airport_id,
            'name' => 'Kantor Cabang Terminal 1',
            'latitude' => -6.1256,
            'longitude' => 106.6559,
            'clock_in_radius_meters' => 100,
            'clock_out_radius_meters' => 300,
            'airport' => ['id' => $this->office->airport_id, 'name' => $this->office->airport->name],
            'is_active' => false,
        ])
        ->assertJsonPath('meta.active_count', 1);
});

it('adds an active office and logs it', function () {
    officeRequest($this->admin, 'POST', '/api/admin/offices', officeForm(['name' => '  Kantor Cabang Terminal 1 ']))
        ->assertCreated()
        ->assertJsonPath('message', 'Perubahan tersimpan.')
        ->assertJsonPath('data.name', 'Kantor Cabang Terminal 1')
        ->assertJsonPath('data.latitude', -6.1275)
        ->assertJsonPath('data.airport_id', $this->office->airport_id)
        ->assertJsonPath('data.is_active', true)
        ->assertJsonPath('meta.active_count', 2);

    expect(AuditLog::sole()->only(['admin_name', 'action', 'object', 'detail']))->toBe([
        'admin_name' => 'Sinta Admin',
        'action' => 'Lokasi & Jadwal',
        'object' => 'Kantor Cabang Terminal 1',
        'detail' => 'Tambah kantor di -6.1275, 106.6537, radius 150 m / 150 m.',
    ]);
});

it('validates the office form', function (array $overrides, string $field, string $message) {
    officeRequest($this->admin, 'POST', '/api/admin/offices', officeForm($overrides))
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);

    expect(Office::query()->count())->toBe(1);
})->with([
    'tanpa pin' => [['latitude' => null], 'latitude', 'Pilih titik kantor di peta.'],
    'titik tidak valid' => [['longitude' => 200], 'longitude', 'Pilih titik kantor di peta.'],
    'tanpa nama' => [['name' => ' '], 'name', 'Nama kantor wajib diisi.'],
    'nama dipakai' => [['name' => 'kantor pusat terminal 3'], 'name', 'Nama kantor sudah dipakai kantor lain di bandara ini.'],
    'tanpa bandara' => [['airport_id' => null], 'airport_id', 'Pilih bandara pemilik titik presensi.'],
    'bandara tidak ada' => [['airport_id' => 999], 'airport_id', 'Pilih bandara pemilik titik presensi.'],
    'radius nol' => [['clock_in_radius_meters' => 0], 'clock_in_radius_meters', 'Isi radius dalam meter, lebih dari 0.'],
    'radius pecahan' => [['clock_out_radius_meters' => 12.5], 'clock_out_radius_meters', 'Isi radius dalam meter, lebih dari 0.'],
    'radius kosong' => [['clock_out_radius_meters' => ''], 'clock_out_radius_meters', 'Isi radius dalam meter, lebih dari 0.'],
]);

it('lets the admin choose any radius above zero, with no fixed range', function () {
    officeRequest($this->admin, 'POST', '/api/admin/offices', officeForm(['clock_in_radius_meters' => 1, 'clock_out_radius_meters' => 5000]))
        ->assertCreated();
});

it('rejects a name used by an inactive office too', function () {
    Office::factory()->inactive()->for($this->office->airport)->create(['name' => 'Kantor Lama']);

    officeRequest($this->admin, 'POST', '/api/admin/offices', officeForm(['name' => 'Kantor Lama']))
        ->assertJsonValidationErrors(['name' => 'Nama kantor sudah dipakai kantor lain di bandara ini.']);
});

it('allows the same name at another airport', function () {
    $halim = Airport::factory()->create();

    officeRequest($this->admin, 'POST', '/api/admin/offices', officeForm(['airport_id' => $halim->id, 'name' => 'Kantor Pusat Terminal 3']))
        ->assertCreated()
        ->assertJsonPath('data.airport', ['id' => $halim->id, 'name' => $halim->name]);
});

it('rejects an inactive airport for a new office', function () {
    $closed = Airport::factory()->inactive()->create();

    officeRequest($this->admin, 'POST', '/api/admin/offices', officeForm(['airport_id' => $closed->id]))
        ->assertJsonValidationErrors(['airport_id' => 'Pilih bandara pemilik titik presensi.']);
});

it('keeps the airport of an office when it is edited', function () {
    $other = Airport::factory()->create();

    officeRequest($this->admin, 'PUT', "/api/admin/offices/{$this->office->id}", officeForm(['airport_id' => $other->id]))->assertOk();

    expect($this->office->refresh()->airport_id)->not->toBe($other->id);
});

describe('ubah kantor', function () {
    it('keeps its own name and logs only what changed', function () {
        officeRequest($this->admin, 'PUT', "/api/admin/offices/{$this->office->id}", officeForm([
            'name' => 'Kantor Pusat Terminal 3', 'latitude' => -6.1256, 'longitude' => 106.6559,
            'clock_in_radius_meters' => 120, 'clock_out_radius_meters' => 300,
        ]))
            ->assertOk()
            ->assertJsonPath('data.clock_in_radius_meters', 120);

        expect(AuditLog::sole()->detail)->toBe('Ubah radius: clock in 120 m, clock out 300 m.');
    });

    it('logs a renamed and moved office', function () {
        officeRequest($this->admin, 'PUT', "/api/admin/offices/{$this->office->id}", officeForm([
            'name' => 'Kantor Pusat T3', 'latitude' => -6.1260, 'longitude' => 106.6559,
            'clock_in_radius_meters' => 100, 'clock_out_radius_meters' => 300,
        ]))->assertOk();

        expect(AuditLog::sole()->only(['object', 'detail']))->toBe([
            'object' => 'Kantor Pusat T3',
            'detail' => 'Ubah nama dari "Kantor Pusat Terminal 3". Ubah titik ke -6.1260, 106.6559.',
        ]);
    });

    it('does not log when nothing changed', function () {
        officeRequest($this->admin, 'PUT', "/api/admin/offices/{$this->office->id}", officeForm([
            'name' => 'Kantor Pusat Terminal 3', 'latitude' => -6.1256, 'longitude' => 106.6559,
            'clock_in_radius_meters' => 100, 'clock_out_radius_meters' => 300,
        ]))->assertOk();

        expect(AuditLog::query()->count())->toBe(0);
    });

    it('applies a new radius to the next clock in without touching old attendance', function () {
        $intern = User::factory()->intern(['start_date' => '2026-09-01', 'end_date' => '2026-12-31', 'airport_id' => $this->office->airport_id])->create();
        $old = Attendance::factory()->for($intern, 'intern')->create(['date' => '2026-10-09', 'clock_in_office_id' => $this->office->id]);

        officeRequest($this->admin, 'PUT', "/api/admin/offices/{$this->office->id}", officeForm([
            'name' => 'Kantor Pusat Terminal 3', 'latitude' => -6.1256, 'longitude' => 106.6559,
            'clock_in_radius_meters' => 300, 'clock_out_radius_meters' => 300,
        ]))->assertOk();

        // Sekitar 222 m dari titik kantor: di luar radius lama 100 m, di dalam radius baru 300 m.
        officeRequest($intern, 'POST', '/api/intern/attendance/clock-in', ['latitude' => -6.1256 + 0.002, 'longitude' => 106.6559])
            ->assertCreated();

        expect($old->refresh()->clock_in_office_id)->toBe($this->office->id);
    });
});

describe('nonaktifkan dan aktifkan', function () {
    it('deactivates an office so interns can no longer use it, and logs it', function () {
        $intern = User::factory()->intern(['start_date' => '2026-09-01', 'end_date' => '2026-12-31', 'airport_id' => $this->office->airport_id])->create();

        officeRequest($this->admin, 'POST', "/api/admin/offices/{$this->office->id}/deactivate")
            ->assertOk()
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('meta.active_count', 0);

        expect(AuditLog::sole()->detail)->toBe('Nonaktifkan kantor.');

        officeRequest($intern, 'GET', '/api/intern/offices')->assertJsonCount(0, 'data');
        officeRequest($intern, 'POST', '/api/intern/attendance/clock-in', ['latitude' => -6.1256, 'longitude' => 106.6559])
            ->assertJsonPath('reason', 'no_active_office');
        officeRequest($this->admin, 'GET', '/api/admin/dashboard')->assertJsonPath('data.has_active_office', false);
    });

    it('activates an office again', function () {
        $this->office->update(['is_active' => false]);

        officeRequest($this->admin, 'POST', "/api/admin/offices/{$this->office->id}/activate")
            ->assertOk()
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('meta.active_count', 1);

        expect(AuditLog::sole()->detail)->toBe('Aktifkan kantor.');
    });

    it('rejects a status that is already set', function (string $action, bool $active, string $reason, string $message) {
        $this->office->update(['is_active' => $active]);

        officeRequest($this->admin, 'POST', "/api/admin/offices/{$this->office->id}/{$action}")
            ->assertUnprocessable()
            ->assertJsonPath('reason', $reason)
            ->assertJsonPath('message', $message);
    })->with([
        ['deactivate', false, 'already_inactive', 'Kantor ini sudah nonaktif.'],
        ['activate', true, 'already_active', 'Kantor ini sudah aktif.'],
    ]);
});

it('has no way to delete an office', function () {
    officeRequest($this->admin, 'DELETE', "/api/admin/offices/{$this->office->id}")->assertMethodNotAllowed();

    expect(Office::query()->count())->toBe(1);
});

it('rejects interns and mentors from the office menu', function (string $role) {
    $actor = User::factory()->{$role}()->create();

    officeRequest($actor, 'GET', '/api/admin/offices')->assertForbidden();
    officeRequest($actor, 'POST', '/api/admin/offices', officeForm())->assertForbidden();
    officeRequest($actor, 'POST', "/api/admin/offices/{$this->office->id}/deactivate")->assertForbidden();
})->with(['intern', 'mentor']);
