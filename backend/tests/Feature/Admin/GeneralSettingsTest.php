<?php

use App\Models\AuditLog;
use App\Models\User;
use App\Services\SystemSettings;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 10:00:00'));

    $this->admin = User::factory()->admin()->create(['name' => 'Sinta Admin']);
});

function generalSettings(User $user, string $method, array $data = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, '/api/admin/settings', $data, ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

function settingsPayload(array $changes = []): array
{
    return ['late_tolerance_minutes' => 15, 'leave_quota' => 3, 'end_reminder_days' => 7, 'leave_escalation_hours' => 24, ...$changes];
}

it('shows the policy numbers, using the defaults when they were never saved', function () {
    generalSettings($this->admin, 'GET')
        ->assertOk()
        ->assertExactJson(['data' => settingsPayload()]);
});

it('saves the changed numbers and logs each change', function () {
    generalSettings($this->admin, 'PUT', settingsPayload(['late_tolerance_minutes' => 10, 'leave_quota' => 4]))
        ->assertOk()
        ->assertJsonPath('message', 'Perubahan tersimpan. Berlaku untuk perhitungan berikutnya.')
        ->assertJsonPath('data', settingsPayload(['late_tolerance_minutes' => 10, 'leave_quota' => 4]));

    expect(app(SystemSettings::class)->leaveQuota())->toBe(4)
        ->and(AuditLog::sole()->only(['action', 'object', 'detail']))->toBe([
            'action' => 'Pengaturan Umum',
            'object' => 'Pengaturan Umum',
            'detail' => 'Ubah toleransi terlambat dari 15 menjadi 10 menit. Ubah kuota izin per magang dari 3 menjadi 4 kali.',
        ]);
});

it('does not log saving without changes', function () {
    generalSettings($this->admin, 'PUT', settingsPayload())->assertOk();

    expect(AuditLog::count())->toBe(0);
});

it('validates each number', function (string $field, mixed $value, string $message) {
    generalSettings($this->admin, 'PUT', settingsPayload([$field => $value]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);
})->with([
    ['late_tolerance_minutes', -1, 'Isi toleransi terlambat 0-120 menit.'],
    ['leave_quota', 0, 'Isi kuota izin 1-30 kali.'],
    ['end_reminder_days', 'tujuh', 'Isi pengingat akhir magang 1-60 hari.'],
    ['leave_escalation_hours', 200, 'Isi batas izin ke admin 1-168 jam.'],
]);

it('rejects interns and mentors', function (string $role) {
    generalSettings(User::factory()->{$role}()->create(), 'GET')->assertForbidden();
})->with(['intern', 'mentor']);
