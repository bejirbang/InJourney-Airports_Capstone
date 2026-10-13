<?php

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

it('lets an admin reset another user and returns the temporary password once', function () {
    $admin = User::factory()->admin()->create(['name' => 'Dedi']);
    $target = User::factory()->intern()->create(['name' => 'Andi Pratama']);
    $target->createToken('api');

    $response = $this->postJson(
        "/api/admin/users/{$target->id}/reset-password",
        [],
        ['Authorization' => 'Bearer '.$admin->createToken('api')->plainTextToken],
    );

    $response->assertOk()->assertJsonStructure(['temporary_password']);

    $temporary = $response->json('temporary_password');
    $target->refresh();

    expect(Hash::check($temporary, $target->password))->toBeTrue()
        ->and($target->must_change_password)->toBeTrue()
        ->and($target->tokens()->count())->toBe(0);

    $log = AuditLog::sole();
    expect($log->admin_id)->toBe($admin->id)
        ->and($log->admin_name)->toBe('Dedi')
        ->and($log->action)->toBe('Akun')
        ->and($log->object)->toBe('Andi Pratama')
        ->and($log->detail)->toBe('Reset password.');
});

it('lets the user log in with the temporary password and requires a change', function () {
    $admin = User::factory()->admin()->create();
    $target = User::factory()->create(['email' => 'mentor@injourney.test']);

    $temporary = $this->postJson(
        "/api/admin/users/{$target->id}/reset-password",
        [],
        ['Authorization' => 'Bearer '.$admin->createToken('api')->plainTextToken],
    )->json('temporary_password');

    $this->postJson('/api/auth/login', ['email' => 'mentor@injourney.test', 'password' => $temporary])
        ->assertOk()
        ->assertJsonPath('user.must_change_password', true);
});

it('does not let an admin reset their own password', function () {
    $admin = User::factory()->admin()->create();

    $this->postJson(
        "/api/admin/users/{$admin->id}/reset-password",
        [],
        ['Authorization' => 'Bearer '.$admin->createToken('api')->plainTextToken],
    )->assertForbidden()
        ->assertJsonPath('message', 'Anda tidak bisa mereset password akun sendiri.');

    expect(AuditLog::count())->toBe(0);
});

it('does not let mentors or interns reset passwords', function (string $role) {
    $actor = User::factory()->{$role}()->create();
    $target = User::factory()->create();

    $this->postJson(
        "/api/admin/users/{$target->id}/reset-password",
        [],
        ['Authorization' => 'Bearer '.$actor->createToken('api')->plainTextToken],
    )->assertForbidden()
        ->assertJsonPath('message', 'Anda tidak memiliki akses.');
})->with(['mentor', 'intern']);
