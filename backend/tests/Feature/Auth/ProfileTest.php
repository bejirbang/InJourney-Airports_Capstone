<?php

use App\Models\Airport;
use App\Models\Unit;
use App\Models\User;

function profileAuth(User $user): array
{
    return ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken];
}

it('updates only the phone number for every role', function (string $role) {
    $user = User::factory()->{$role}()->create(['name' => 'Sari', 'phone' => null]);

    $this->putJson('/api/auth/profile', ['name' => 'Sari Wijaya', 'phone' => '0812-3456-7890'], profileAuth($user))
        ->assertOk()
        ->assertJsonPath('message', 'Perubahan tersimpan.')
        ->assertJsonPath('data.name', 'Sari')
        ->assertJsonPath('data.phone', '0812-3456-7890')
        ->assertJsonPath('data.role', $role);

    expect($user->fresh())->name->toBe('Sari')->phone->toBe('0812-3456-7890');
})->with(['mentor', 'intern', 'admin']);

it('clears the phone number when it is sent empty', function () {
    $user = User::factory()->mentor()->create(['phone' => '0812-3456-7890']);

    $this->putJson('/api/auth/profile', ['phone' => ''], profileAuth($user))
        ->assertOk()
        ->assertJsonPath('data.phone', null);
});

it('ignores fields that only an admin may change', function () {
    $unit = Unit::factory()->create();
    $user = User::factory()->mentor()->create(['name' => 'Sari', 'email' => 'mentor@injourney.test', 'unit_id' => $unit->id]);

    $this->putJson('/api/auth/profile', [
        'phone' => '0812-3456-7890',
        'name' => 'Sari Wijaya',
        'email' => 'lain@injourney.test',
        'role' => 'admin',
        'unit_id' => Unit::factory()->create()->id,
        'is_active' => false,
    ], profileAuth($user))->assertOk();

    expect($user->fresh())
        ->name->toBe('Sari')
        ->email->toBe('mentor@injourney.test')
        ->role->value->toBe('mentor')
        ->unit_id->toBe($unit->id)
        ->is_active->toBeTrue();
});

it('validates the phone number', function (array $input) {
    $user = User::factory()->mentor()->create();

    $this->putJson('/api/auth/profile', $input, profileAuth($user))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['phone' => 'Format nomor telepon tidak valid.']);
})->with([
    'tidak dikirim' => [[]],
    'berisi huruf' => [['phone' => '0812abc']],
    'terlalu pendek' => [['phone' => '0812']],
]);

it('shows the intern profile with unit, airport, campus, mentor, and period', function () {
    $mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $airport = Airport::factory()->create(['name' => 'Soekarno-Hatta']);
    $intern = User::factory()->intern([
        'mentor_id' => $mentor->id,
        'airport_id' => $airport->id,
        'university' => 'Telkom University',
        'major' => 'Sistem Informasi',
        'start_date' => '2026-09-01',
        'end_date' => now()->addMonth()->toDateString(),
    ])->create();

    $this->getJson('/api/auth/me', profileAuth($intern))
        ->assertOk()
        ->assertJsonPath('data.unit', ['id' => $intern->unit_id, 'name' => $intern->unit?->name])
        ->assertJsonPath('data.intern_profile', [
            'mentor' => ['id' => $mentor->id, 'name' => 'Sari Wijaya'],
            'airport' => ['id' => $airport->id, 'name' => 'Soekarno-Hatta'],
            'university' => 'Telkom University',
            'major' => 'Sistem Informasi',
            'start_date' => '2026-09-01',
            'end_date' => now()->addMonth()->toDateString(),
        ])
        ->assertJsonMissingPath('data.photo_url')
        ->assertJsonMissingPath('data.title');
});

it('has no intern profile for a mentor', function () {
    $user = User::factory()->mentor()->create();

    $this->getJson('/api/auth/me', profileAuth($user))
        ->assertOk()
        ->assertJsonPath('data.unit', ['id' => $user->unit_id, 'name' => $user->unit?->name])
        ->assertJsonMissingPath('data.intern_profile');
});

it('no longer accepts profile photo uploads', function () {
    $user = User::factory()->mentor()->create();

    $this->postJson('/api/auth/profile/photo', [], profileAuth($user))->assertNotFound();
});

it('blocks profile changes until the temporary password is changed', function () {
    $user = User::factory()->mentor()->mustChangePassword()->create();

    $this->putJson('/api/auth/profile', ['phone' => '0812-3456-7890'], profileAuth($user))
        ->assertForbidden()
        ->assertJsonPath('must_change_password', true);
});

it('rejects profile changes without a token', function () {
    $this->putJson('/api/auth/profile', ['phone' => '0812-3456-7890'])->assertUnauthorized();
});
