<?php

use App\Models\Unit;
use App\Models\User;

function profileAuth(User $user): array
{
    return ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken];
}

it('updates name and phone for every role', function (string $role) {
    $user = User::factory()->{$role}()->create(['name' => 'Sari', 'phone' => null]);

    $this->putJson('/api/auth/profile', ['name' => 'Sari Wijaya', 'phone' => '0812-3456-7890'], profileAuth($user))
        ->assertOk()
        ->assertJsonPath('message', 'Perubahan tersimpan.')
        ->assertJsonPath('data.name', 'Sari Wijaya')
        ->assertJsonPath('data.phone', '0812-3456-7890')
        ->assertJsonPath('data.role', $role);

    expect($user->fresh())->name->toBe('Sari Wijaya')->phone->toBe('0812-3456-7890');
})->with(['mentor', 'intern', 'admin']);

it('clears the phone number when it is sent empty', function () {
    $user = User::factory()->mentor()->create(['phone' => '0812-3456-7890']);

    $this->putJson('/api/auth/profile', ['name' => $user->name, 'phone' => ''], profileAuth($user))
        ->assertOk()
        ->assertJsonPath('data.phone', null);
});

it('ignores fields that only an admin may change', function () {
    $unit = Unit::factory()->create();
    $user = User::factory()->mentor()->create(['email' => 'mentor@injourney.test', 'unit_id' => $unit->id]);

    $this->putJson('/api/auth/profile', [
        'name' => 'Sari Wijaya',
        'email' => 'lain@injourney.test',
        'role' => 'admin',
        'unit_id' => Unit::factory()->create()->id,
        'is_active' => false,
    ], profileAuth($user))->assertOk();

    expect($user->fresh())
        ->email->toBe('mentor@injourney.test')
        ->role->value->toBe('mentor')
        ->unit_id->toBe($unit->id)
        ->is_active->toBeTrue();
});

it('validates the profile form', function (array $input, string $field, string $message) {
    $user = User::factory()->mentor()->create();

    $this->putJson('/api/auth/profile', $input, profileAuth($user))
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);
})->with([
    'nama kosong' => [['name' => '   '], 'name', 'Nama wajib diisi.'],
    'nama tidak dikirim' => [['phone' => '0812'], 'name', 'Nama wajib diisi.'],
    'telepon berisi huruf' => [['name' => 'Sari', 'phone' => '0812abc'], 'phone', 'Format nomor telepon tidak valid.'],
    'telepon terlalu pendek' => [['name' => 'Sari', 'phone' => '0812'], 'phone', 'Format nomor telepon tidak valid.'],
]);

it('returns the unit and no photo url in the profile', function () {
    $user = User::factory()->mentor()->create();

    $this->getJson('/api/auth/me', profileAuth($user))
        ->assertOk()
        ->assertJsonPath('data.unit', ['id' => $user->unit_id, 'name' => $user->unit?->name])
        ->assertJsonMissingPath('data.photo_url')
        ->assertJsonMissingPath('data.title');
});

it('no longer accepts profile photo uploads', function () {
    $user = User::factory()->mentor()->create();

    $this->postJson('/api/auth/profile/photo', [], profileAuth($user))->assertNotFound();
});

it('blocks profile changes until the temporary password is changed', function () {
    $user = User::factory()->mentor()->mustChangePassword()->create();

    $this->putJson('/api/auth/profile', ['name' => 'Sari'], profileAuth($user))
        ->assertForbidden()
        ->assertJsonPath('must_change_password', true);
});

it('rejects profile changes without a token', function () {
    $this->putJson('/api/auth/profile', ['name' => 'Sari'])->assertUnauthorized();
});
