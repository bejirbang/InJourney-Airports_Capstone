<?php

use App\Models\User;

it('logs in with valid credentials and returns a token', function () {
    $user = User::factory()->create(['email' => 'mentor@injourney.test']);

    $response = $this->postJson('/api/auth/login', [
        'email' => 'Mentor@InJourney.test',
        'password' => 'password',
    ]);

    $response->assertOk()
        ->assertJsonPath('user.id', $user->id)
        ->assertJsonPath('user.role', 'mentor')
        ->assertJsonPath('user.must_change_password', false)
        ->assertJsonStructure(['token']);

    expect($user->tokens()->count())->toBe(1);
});

it('rejects a wrong password with the same message as an unknown email', function (string $email) {
    User::factory()->create(['email' => 'mentor@injourney.test']);

    $this->postJson('/api/auth/login', ['email' => $email, 'password' => 'salah123'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email' => 'Email atau password salah.']);
})->with(['mentor@injourney.test', 'tidakada@injourney.test']);

it('validates required fields in Indonesian', function () {
    $this->postJson('/api/auth/login', [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'email' => 'Email wajib diisi.',
            'password' => 'Password wajib diisi.',
        ]);
});

it('rejects a deactivated account', function () {
    User::factory()->inactive()->create(['email' => 'mentor@injourney.test']);

    $this->postJson('/api/auth/login', ['email' => 'mentor@injourney.test', 'password' => 'password'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Akun Anda tidak aktif. Hubungi admin.');
});

it('rejects an intern whose internship has not started', function () {
    User::factory()->intern([
        'start_date' => now()->addDay()->toDateString(),
        'end_date' => now()->addMonths(3)->toDateString(),
    ])->create(['email' => 'intern@injourney.test']);

    $this->postJson('/api/auth/login', ['email' => 'intern@injourney.test', 'password' => 'password'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Masa magang Anda belum dimulai.');
});

it('rejects an intern from the day after the internship ends', function () {
    User::factory()->intern([
        'start_date' => now()->subMonths(3)->toDateString(),
        'end_date' => now()->subDay()->toDateString(),
    ])->create(['email' => 'intern@injourney.test']);

    $this->postJson('/api/auth/login', ['email' => 'intern@injourney.test', 'password' => 'password'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Akun Anda tidak aktif. Hubungi admin.');
});

it('still lets an intern log in on the last day of the internship', function () {
    User::factory()->intern([
        'start_date' => now()->subMonths(3)->toDateString(),
        'end_date' => now()->toDateString(),
    ])->create(['email' => 'intern@injourney.test']);

    $this->postJson('/api/auth/login', ['email' => 'intern@injourney.test', 'password' => 'password'])
        ->assertOk()
        ->assertJsonPath('user.intern_profile.end_date', now()->toDateString());
});

it('rejects a soft deleted account', function () {
    User::factory()->create(['email' => 'mentor@injourney.test'])->delete();

    $this->postJson('/api/auth/login', ['email' => 'mentor@injourney.test', 'password' => 'password'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email' => 'Email atau password salah.']);
});

it('throttles repeated login attempts', function () {
    User::factory()->create(['email' => 'mentor@injourney.test']);

    foreach (range(1, 5) as $attempt) {
        $this->postJson('/api/auth/login', ['email' => 'mentor@injourney.test', 'password' => 'salah123']);
    }

    $this->postJson('/api/auth/login', ['email' => 'mentor@injourney.test', 'password' => 'password'])
        ->assertTooManyRequests()
        ->assertJsonPath('message', fn (string $message) => str_starts_with($message, 'Terlalu banyak percobaan masuk.'));
});
