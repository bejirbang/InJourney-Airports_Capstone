<?php

use App\Enums\CorrectionStatus;
use App\Enums\RequestStatus;
use App\Models\AttendanceCorrection;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

function adminMenu(User $user): TestResponse
{
    return test()->getJson('/api/admin/menu', ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

it('sends an admin to the admin dashboard after login', function () {
    User::factory()->admin()->create(['email' => 'admin@injourney.test']);

    $this->postJson('/api/auth/login', ['email' => 'admin@injourney.test', 'password' => 'password'])
        ->assertOk()
        ->assertJsonPath('user.role', 'admin')
        ->assertJsonPath('user.must_change_password', false)
        ->assertJsonPath('user.home_path', '/admin/dashboard');
});

it('asks a new admin to change the password first, then lands on the admin dashboard', function () {
    User::factory()->admin()->mustChangePassword()->create(['email' => 'admin.baru@injourney.test']);

    $login = $this->postJson('/api/auth/login', ['email' => 'admin.baru@injourney.test', 'password' => 'password'])
        ->assertOk()
        ->assertJsonPath('user.must_change_password', true)
        ->assertJsonPath('user.home_path', '/admin/dashboard');

    $headers = ['Authorization' => 'Bearer '.$login->json('token')];

    $this->getJson('/api/admin/menu', $headers)
        ->assertForbidden()
        ->assertJsonPath('must_change_password', true);

    $this->putJson('/api/auth/password', ['password' => 'Rahasia123', 'password_confirmation' => 'Rahasia123'], $headers)
        ->assertOk()
        ->assertJsonPath('data.must_change_password', false)
        ->assertJsonPath('data.home_path', '/admin/dashboard');

    $this->getJson('/api/admin/menu', $headers)->assertOk();
});

it('returns the admin menu for a logged-in admin', function () {
    adminMenu(User::factory()->admin()->create())
        ->assertOk()
        ->assertExactJson(['data' => [
            ['key' => 'dashboard', 'path' => '/admin/dashboard', 'badge' => null],
            ['key' => 'users', 'path' => '/admin/users', 'badge' => null],
            ['key' => 'attendance', 'path' => '/admin/attendance', 'badge' => null],
            ['key' => 'corrections', 'path' => '/admin/corrections', 'badge' => 0],
            ['key' => 'leaves', 'path' => '/admin/leaves', 'badge' => 0],
            ['key' => 'presentations', 'path' => '/admin/presentations', 'badge' => 0],
            ['key' => 'assessments', 'path' => '/admin/assessments', 'badge' => null],
            ['key' => 'warnings', 'path' => '/admin/warnings', 'badge' => null],
            ['key' => 'announcements', 'path' => '/admin/announcements', 'badge' => null],
            ['key' => 'reports', 'path' => '/admin/reports', 'badge' => null],
            ['key' => 'settings', 'path' => '/admin/settings', 'badge' => null],
            ['key' => 'offices', 'path' => '/admin/offices', 'badge' => null],
            ['key' => 'audit_log', 'path' => '/admin/audit-log', 'badge' => null],
        ]]);
});

it('counts corrections waiting for an admin decision of every intern', function () {
    $admin = User::factory()->admin()->create();

    AttendanceCorrection::factory()->count(2)->pendingAdmin()->create();
    AttendanceCorrection::factory()->create();
    AttendanceCorrection::factory()->decidedByAdmin(CorrectionStatus::Approved, $admin)->create();
    AttendanceCorrection::factory()->decidedByAdmin(CorrectionStatus::RejectedByAdmin, $admin)->create();

    adminMenu($admin)
        ->assertOk()
        ->assertJsonPath('data.3.key', 'corrections')
        ->assertJsonPath('data.3.badge', 2);
});

it('counts only leaves pending for more than 24 hours', function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));
    $andi = User::factory()->intern()->create();

    // Lebih dari 24 jam: 26 jam dan tepat 24 jam 1 menit.
    LeaveRequest::factory()->for($andi, 'intern')->create(['status' => RequestStatus::Pending, 'created_at' => '2026-10-11 12:39:00']);
    LeaveRequest::factory()->for($andi, 'intern')->create(['status' => RequestStatus::Pending, 'created_at' => '2026-10-11 14:38:00']);
    // Belum lebih dari 24 jam (tepat 24 jam dan 14 jam), atau sudah tidak Pending.
    LeaveRequest::factory()->for($andi, 'intern')->create(['status' => RequestStatus::Pending, 'created_at' => '2026-10-11 14:39:00']);
    LeaveRequest::factory()->for($andi, 'intern')->create(['status' => RequestStatus::Pending, 'created_at' => '2026-10-12 00:39:00']);
    LeaveRequest::factory()->for($andi, 'intern')->create(['status' => RequestStatus::Approved, 'created_at' => '2026-10-09 09:00:00']);
    LeaveRequest::factory()->for($andi, 'intern')->create(['status' => RequestStatus::Cancelled, 'created_at' => '2026-10-09 09:00:00']);

    adminMenu(User::factory()->admin()->create())
        ->assertOk()
        ->assertJsonPath('data.4.key', 'leaves')
        ->assertJsonPath('data.4.badge', 2);
});

it('rejects interns and mentors from the admin menu', function (string $role) {
    adminMenu(User::factory()->{$role}()->create())
        ->assertForbidden()
        ->assertJsonPath('message', 'Anda tidak memiliki akses.');
})->with(['intern', 'mentor']);

it('rejects an inactive admin and revokes the token', function () {
    $admin = User::factory()->admin()->inactive()->create();

    adminMenu($admin)->assertForbidden();

    expect($admin->tokens()->count())->toBe(0);
});

it('rejects the admin menu without a token', function () {
    $this->getJson('/api/admin/menu')->assertUnauthorized();
});
