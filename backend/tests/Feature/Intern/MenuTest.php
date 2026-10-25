<?php

use App\Models\User;

it('sends an intern to the intern dashboard after login', function () {
    User::factory()->intern()->create(['email' => 'intern@injourney.test']);

    $this->postJson('/api/auth/login', ['email' => 'intern@injourney.test', 'password' => 'password'])
        ->assertOk()
        ->assertJsonPath('user.role', 'intern')
        ->assertJsonPath('user.must_change_password', false)
        ->assertJsonPath('user.home_path', '/intern/dashboard');
});

it('keeps the intern home path while a password change is still required', function () {
    User::factory()->intern()->mustChangePassword()->create(['email' => 'intern.baru@injourney.test']);

    $this->postJson('/api/auth/login', ['email' => 'intern.baru@injourney.test', 'password' => 'password'])
        ->assertOk()
        ->assertJsonPath('user.must_change_password', true)
        ->assertJsonPath('user.home_path', '/intern/dashboard');
});

it('returns the intern menu for a logged-in intern', function () {
    $intern = User::factory()->intern()->create();

    $this->getJson('/api/intern/menu', ['Authorization' => 'Bearer '.$intern->createToken('api')->plainTextToken])
        ->assertOk()
        ->assertExactJson(['data' => [
            ['key' => 'dashboard', 'path' => '/intern/dashboard'],
            ['key' => 'attendance', 'path' => '/intern/attendance'],
            ['key' => 'leaves', 'path' => '/intern/leaves'],
        ]]);
});

it('rejects mentors and admins from the intern menu', function (string $role) {
    $user = User::factory()->{$role}()->create();

    $this->getJson('/api/intern/menu', ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken])
        ->assertForbidden()
        ->assertJsonPath('message', 'Anda tidak memiliki akses.');
})->with(['mentor', 'admin']);

it('rejects an intern who has not changed the temporary password', function () {
    $intern = User::factory()->intern()->mustChangePassword()->create();

    $this->getJson('/api/intern/menu', ['Authorization' => 'Bearer '.$intern->createToken('api')->plainTextToken])
        ->assertForbidden()
        ->assertJsonPath('must_change_password', true);
});

it('rejects the intern menu without a token', function () {
    $this->getJson('/api/intern/menu')->assertUnauthorized();
});
