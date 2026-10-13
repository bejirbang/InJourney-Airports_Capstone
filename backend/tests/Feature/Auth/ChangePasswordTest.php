<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

it('changes the temporary password and clears the flag', function () {
    $user = User::factory()->mustChangePassword()->create();
    $current = $user->createToken('api')->plainTextToken;
    $user->createToken('api');

    $this->putJson('/api/auth/password', [
        'password' => 'rahasia123',
        'password_confirmation' => 'rahasia123',
    ], ['Authorization' => 'Bearer '.$current])
        ->assertOk()
        ->assertJsonPath('data.must_change_password', false);

    $user->refresh();

    expect(Hash::check('rahasia123', $user->password))->toBeTrue()
        ->and($user->must_change_password)->toBeFalse()
        ->and($user->tokens()->count())->toBe(1);
});

it('validates the password rules with the frontend messages', function (array $input, string $message) {
    $user = User::factory()->mustChangePassword()->create(['password' => 'sementara1']);
    $token = $user->createToken('api')->plainTextToken;

    $this->putJson('/api/auth/password', $input, ['Authorization' => 'Bearer '.$token])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['password' => $message]);
})->with([
    'terlalu pendek' => [['password' => 'abc12', 'password_confirmation' => 'abc12'], 'Password minimal 8 karakter dan berisi huruf serta angka.'],
    'tanpa angka' => [['password' => 'abcdefgh', 'password_confirmation' => 'abcdefgh'], 'Password minimal 8 karakter dan berisi huruf serta angka.'],
    'tanpa huruf' => [['password' => '12345678', 'password_confirmation' => '12345678'], 'Password minimal 8 karakter dan berisi huruf serta angka.'],
    'konfirmasi beda' => [['password' => 'rahasia123', 'password_confirmation' => 'rahasia124'], 'Ulangi password baru dengan isian yang sama.'],
    'sama dengan sementara' => [['password' => 'sementara1', 'password_confirmation' => 'sementara1'], 'Password baru tidak boleh sama dengan password sementara.'],
]);

it('does not allow self-service password changes', function () {
    $user = User::factory()->create();
    $token = $user->createToken('api')->plainTextToken;

    $this->putJson('/api/auth/password', [
        'password' => 'rahasia123',
        'password_confirmation' => 'rahasia123',
    ], ['Authorization' => 'Bearer '.$token])
        ->assertForbidden()
        ->assertJsonPath('message', 'Password hanya bisa diganti saat login pertama atau setelah direset admin.');
});

it('blocks other endpoints until the temporary password is changed', function () {
    $admin = User::factory()->admin()->mustChangePassword()->create();
    $target = User::factory()->create();
    $token = $admin->createToken('api')->plainTextToken;

    $this->postJson("/api/admin/users/{$target->id}/reset-password", [], ['Authorization' => 'Bearer '.$token])
        ->assertForbidden()
        ->assertJsonPath('must_change_password', true);
});
