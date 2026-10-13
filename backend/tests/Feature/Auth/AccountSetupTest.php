<?php

use App\Enums\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;

it('seeds sample accounts that can log in', function () {
    $this->seed(DatabaseSeeder::class);

    expect(User::count())->toBe(4);

    foreach (['admin', 'mentor', 'intern'] as $role) {
        $this->postJson('/api/auth/login', ['email' => "{$role}@injourney.test", 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.role', $role);
    }
});

it('creates the first admin with a temporary password', function () {
    $this->artisan('app:create-admin', ['email' => 'Admin@InJourney.co.id', 'name' => 'Admin Pertama'])
        ->expectsOutputToContain('Password sementara:')
        ->assertSuccessful();

    $admin = User::sole();

    expect($admin->email)->toBe('admin@injourney.co.id')
        ->and($admin->role)->toBe(Role::Admin)
        ->and($admin->must_change_password)->toBeTrue();
});

it('refuses to create an admin with an email that is already used', function () {
    User::factory()->create(['email' => 'admin@injourney.co.id']);

    $this->artisan('app:create-admin', ['email' => 'admin@injourney.co.id', 'name' => 'Admin Kedua'])
        ->expectsOutputToContain('Email sudah terdaftar.')
        ->assertFailed();
});
