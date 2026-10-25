<?php

use App\Models\User;

function bearer(string $token): array
{
    return ['Authorization' => 'Bearer '.$token];
}

it('returns the current user', function () {
    $user = User::factory()->intern()->create();
    $token = $user->createToken('api')->plainTextToken;

    $this->getJson('/api/auth/me', bearer($token))
        ->assertOk()
        ->assertJsonPath('data.id', $user->id)
        ->assertJsonPath('data.role', 'intern')
        ->assertJsonPath('data.intern_profile.mentor.id', $user->internProfile->mentor_id);
});

it('rejects requests without a token in Indonesian', function () {
    $this->getJson('/api/auth/me')
        ->assertUnauthorized()
        ->assertJsonPath('message', 'Sesi Anda sudah berakhir. Silakan masuk lagi.');
});

it('logs out by revoking only the current token', function () {
    $user = User::factory()->create();
    $current = $user->createToken('api')->plainTextToken;
    $user->createToken('api');

    $this->postJson('/api/auth/logout', [], bearer($current))->assertNoContent();

    expect($user->tokens()->count())->toBe(1);

    $this->app['auth']->forgetGuards();

    $this->getJson('/api/auth/me', bearer($current))->assertUnauthorized();
});

it('revokes the token of an account deactivated while logged in', function () {
    $user = User::factory()->create();
    $token = $user->createToken('api')->plainTextToken;

    $user->update(['is_active' => false]);

    $this->getJson('/api/auth/me', bearer($token))
        ->assertForbidden()
        ->assertJsonPath('message', 'Akun Anda tidak aktif. Hubungi admin.');

    expect($user->tokens()->count())->toBe(0);
});
