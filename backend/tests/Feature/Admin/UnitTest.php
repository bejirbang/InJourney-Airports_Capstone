<?php

use App\Models\AuditLog;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Sinta Admin']);
    $this->it = Unit::factory()->create(['name' => 'Divisi IT']);
});

function unitRequest(User $user, string $method, string $uri, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

it('lists units by name with the number of accounts using them', function () {
    $finance = Unit::factory()->inactive()->create(['name' => 'Akuntansi']);
    User::factory()->mentor()->count(2)->create(['unit_id' => $this->it->id]);

    unitRequest($this->admin, 'GET', '/api/admin/units')
        ->assertOk()
        ->assertExactJson(['data' => [
            ['id' => $finance->id, 'name' => 'Akuntansi', 'is_active' => false, 'user_count' => 0],
            ['id' => $this->it->id, 'name' => 'Divisi IT', 'is_active' => true, 'user_count' => 2],
        ]]);
});

it('adds a unit with a trimmed name and logs it', function () {
    unitRequest($this->admin, 'POST', '/api/admin/units', ['name' => '  Operasional Bandara  '])
        ->assertCreated()
        ->assertJsonPath('message', 'Unit ditambahkan.')
        ->assertJsonPath('data.name', 'Operasional Bandara')
        ->assertJsonPath('data.is_active', true)
        ->assertJsonPath('data.user_count', 0);

    expect(AuditLog::sole()->only(['action', 'object', 'detail']))->toBe(['action' => 'Unit', 'object' => 'Operasional Bandara', 'detail' => 'Tambah unit.']);
});

it('rejects an empty or duplicate name regardless of case', function (string $name, string $message) {
    unitRequest($this->admin, 'POST', '/api/admin/units', ['name' => $name])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name' => $message]);
})->with([
    'kosong' => ['   ', 'Nama unit wajib diisi.'],
    'sama' => ['divisi it', 'Nama unit sudah dipakai.'],
]);

it('renames a unit and logs the old name, ignoring an unchanged name', function () {
    unitRequest($this->admin, 'PUT', "/api/admin/units/{$this->it->id}", ['name' => 'Divisi IT'])->assertOk();
    expect(AuditLog::count())->toBe(0);

    unitRequest($this->admin, 'PUT', "/api/admin/units/{$this->it->id}", ['name' => 'Teknologi Informasi'])
        ->assertOk()
        ->assertJsonPath('data.name', 'Teknologi Informasi');

    expect(AuditLog::sole()->detail)->toBe('Ubah nama dari "Divisi IT".');
});

it('deactivates and reactivates a unit without touching accounts that use it', function () {
    $mentor = User::factory()->mentor()->create(['unit_id' => $this->it->id]);

    unitRequest($this->admin, 'POST', "/api/admin/units/{$this->it->id}/deactivate")
        ->assertOk()
        ->assertJsonPath('data.is_active', false)
        ->assertJsonPath('data.user_count', 1);

    unitRequest($this->admin, 'POST', "/api/admin/units/{$this->it->id}/deactivate")
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Unit ini sudah nonaktif.');

    unitRequest($this->admin, 'POST', "/api/admin/units/{$this->it->id}/activate")->assertOk()->assertJsonPath('data.is_active', true);

    expect($mentor->fresh()->unit_id)->toBe($this->it->id)
        ->and(AuditLog::query()->orderBy('id')->pluck('detail')->all())->toBe(['Nonaktifkan unit.', 'Aktifkan unit.']);
});

it('has no delete endpoint and rejects non-admins', function () {
    unitRequest($this->admin, 'DELETE', "/api/admin/units/{$this->it->id}")->assertMethodNotAllowed();
    unitRequest(User::factory()->mentor()->create(), 'GET', '/api/admin/units')->assertForbidden();
});
