<?php

use App\Enums\RequestStatus;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Testing\TestResponse;

function mentorMenu(User $user): TestResponse
{
    return test()->getJson('/api/mentor/menu', ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken]);
}

it('sends a mentor to the mentor dashboard after login', function () {
    User::factory()->mentor()->create(['email' => 'mentor@injourney.test']);

    $this->postJson('/api/auth/login', ['email' => 'mentor@injourney.test', 'password' => 'password'])
        ->assertOk()
        ->assertJsonPath('user.role', 'mentor')
        ->assertJsonPath('user.must_change_password', false)
        ->assertJsonPath('user.home_path', '/mentor/dashboard');
});

it('asks a new mentor to change the password first, then lands on the mentor dashboard', function () {
    User::factory()->mentor()->mustChangePassword()->create(['email' => 'mentor.baru@injourney.test']);

    $login = $this->postJson('/api/auth/login', ['email' => 'mentor.baru@injourney.test', 'password' => 'password'])
        ->assertOk()
        ->assertJsonPath('user.must_change_password', true)
        ->assertJsonPath('user.home_path', '/mentor/dashboard');

    $headers = ['Authorization' => 'Bearer '.$login->json('token')];

    $this->getJson('/api/mentor/menu', $headers)
        ->assertForbidden()
        ->assertJsonPath('must_change_password', true);

    $this->putJson('/api/auth/password', ['password' => 'Rahasia123', 'password_confirmation' => 'Rahasia123'], $headers)
        ->assertOk()
        ->assertJsonPath('data.must_change_password', false)
        ->assertJsonPath('data.home_path', '/mentor/dashboard');

    $this->getJson('/api/mentor/menu', $headers)->assertOk();
});

it('returns the mentor menu for a logged-in mentor', function () {
    mentorMenu(User::factory()->mentor()->create())
        ->assertOk()
        ->assertExactJson(['data' => [
            ['key' => 'dashboard', 'path' => '/mentor/dashboard', 'badge' => null],
            ['key' => 'interns', 'path' => '/mentor/interns', 'badge' => null],
            ['key' => 'logbooks', 'path' => '/mentor/logbooks', 'badge' => 0],
            ['key' => 'corrections', 'path' => '/mentor/corrections', 'badge' => 0],
            ['key' => 'leaves', 'path' => '/mentor/leaves', 'badge' => 0],
            ['key' => 'leave_calendar', 'path' => '/mentor/leave-calendar', 'badge' => null],
            ['key' => 'performance', 'path' => '/mentor/performance', 'badge' => null],
            ['key' => 'assessments', 'path' => '/mentor/assessments', 'badge' => 0],
        ]]);
});

it('counts only pending leaves of interns currently mentored by this mentor', function () {
    $mentor = User::factory()->mentor()->create();
    $andi = User::factory()->intern(['mentor_id' => $mentor->id])->create();
    $dewi = User::factory()->intern(['mentor_id' => $mentor->id])->create();
    $other = User::factory()->intern()->create();

    LeaveRequest::factory()->for($andi, 'intern')->create(['status' => RequestStatus::Pending]);
    LeaveRequest::factory()->for($dewi, 'intern')->create(['status' => RequestStatus::Pending]);
    LeaveRequest::factory()->for($dewi, 'intern')->create(['status' => RequestStatus::Approved]);
    LeaveRequest::factory()->for($andi, 'intern')->create(['status' => RequestStatus::Cancelled]);
    LeaveRequest::factory()->for($other, 'intern')->create(['status' => RequestStatus::Pending]);

    mentorMenu($mentor)
        ->assertOk()
        ->assertJsonPath('data.4.key', 'leaves')
        ->assertJsonPath('data.4.badge', 2);
});

it('rejects interns and admins from the mentor menu', function (string $role) {
    mentorMenu(User::factory()->{$role}()->create())
        ->assertForbidden()
        ->assertJsonPath('message', 'Anda tidak memiliki akses.');
})->with(['intern', 'admin']);

it('rejects an inactive mentor and revokes the token', function () {
    $mentor = User::factory()->mentor()->inactive()->create();

    mentorMenu($mentor)->assertForbidden();

    expect($mentor->tokens()->count())->toBe(0);
});

it('rejects the mentor menu without a token', function () {
    $this->getJson('/api/mentor/menu')->assertUnauthorized();
});
