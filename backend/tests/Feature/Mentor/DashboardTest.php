<?php

use App\Enums\LeaveType;
use App\Enums\RequestStatus;
use App\Models\Announcement;
use App\Models\Attendance;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
});

function mentorDashboard(User $mentor): TestResponse
{
    return test()->getJson('/api/mentor/dashboard', [
        'Authorization' => 'Bearer '.$mentor->createToken('api')->plainTextToken,
    ]);
}

function menteeOf(User $mentor, string $name, array $profile = [], array $attributes = []): User
{
    return User::factory()->intern([
        'mentor_id' => $mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
        ...$profile,
    ])->create(['name' => $name, ...$attributes]);
}

it('tells the frontend when the mentor has no interns yet', function () {
    mentorDashboard($this->mentor)
        ->assertOk()
        ->assertJsonPath('data.date', '2026-10-12')
        ->assertJsonPath('data.holiday', null)
        ->assertJsonPath('data.interns_total', 0)
        ->assertJsonPath('data.today', ['interns' => 0, 'clocked_in' => 0, 'on_leave' => 0, 'not_clocked_in' => 0])
        ->assertJsonPath('data.pending_leaves', ['total' => 0, 'items' => []])
        ->assertJsonMissingPath('data.review_tasks')
        ->assertJsonMissingPath('data.late_tasks');
});

it('counts today per intern: clocked in, on leave, and not clocked in yet', function () {
    $andi = menteeOf($this->mentor, 'Andi Pratama');
    $rina = menteeOf($this->mentor, 'Rina Wulandari');
    $dewi = menteeOf($this->mentor, 'Dewi Sartika');
    $budi = menteeOf($this->mentor, 'Budi Kurnia');
    $doni = menteeOf($this->mentor, 'Doni Andika');

    Attendance::factory()->for($andi, 'intern')->create(['clock_out_at' => null]);
    Attendance::factory()->for($rina, 'intern')->create();
    LeaveRequest::factory()->for($dewi, 'intern')->approved()->create();
    Attendance::factory()->for($budi, 'intern')->create();
    LeaveRequest::factory()->for($budi, 'intern')->approved()->create();
    LeaveRequest::factory()->for($doni, 'intern')->create();

    mentorDashboard($this->mentor)
        ->assertOk()
        ->assertJsonPath('data.interns_total', 5)
        ->assertJsonPath('data.today', ['interns' => 5, 'clocked_in' => 3, 'on_leave' => 1, 'not_clocked_in' => 1]);
});

it('leaves inactive, not yet started, ended, and other mentors\' interns out of the today card', function () {
    menteeOf($this->mentor, 'Andi Pratama');
    menteeOf($this->mentor, 'Nonaktif', attributes: ['is_active' => false]);
    menteeOf($this->mentor, 'Belum Mulai', ['start_date' => '2026-10-13']);
    menteeOf($this->mentor, 'Sudah Selesai', ['end_date' => '2026-10-11']);
    User::factory()->intern()->create();

    mentorDashboard($this->mentor)
        ->assertOk()
        ->assertJsonPath('data.interns_total', 4)
        ->assertJsonPath('data.today.interns', 1)
        ->assertJsonPath('data.today.not_clocked_in', 1);
});

it('hides the today card on a holiday', function () {
    menteeOf($this->mentor, 'Andi Pratama');
    Holiday::factory()->create(['date' => '2026-10-12', 'name' => 'Libur Nasional']);

    mentorDashboard($this->mentor)
        ->assertOk()
        ->assertJsonPath('data.holiday', ['name' => 'Libur Nasional'])
        ->assertJsonPath('data.today', null);
});

it('hides the today card on a weekend', function () {
    $this->travelTo(Carbon::parse('2026-10-17 09:00:00'));
    menteeOf($this->mentor, 'Andi Pratama');

    mentorDashboard($this->mentor)
        ->assertOk()
        ->assertJsonPath('data.holiday', ['name' => null])
        ->assertJsonPath('data.today', null);
});

it('shows at most five rows per box but the full total', function () {
    $andi = menteeOf($this->mentor, 'Andi Pratama');

    foreach (range(1, 7) as $i) {
        LeaveRequest::factory()->for($andi, 'intern')->create(['created_at' => "2026-10-0{$i} 09:00:00"]);
    }

    $response = mentorDashboard($this->mentor)->assertOk()->assertJsonPath('data.pending_leaves.total', 7);

    expect($response->json('data.pending_leaves.items'))->toHaveCount(5);
});

it('lists pending leaves of current interns, longest pending first, with an overdue mark after 24 hours', function () {
    $andi = menteeOf($this->mentor, 'Andi Pratama');
    $dewi = menteeOf($this->mentor, 'Dewi Sartika');

    $recent = LeaveRequest::factory()->for($andi, 'intern')->create([
        'type' => LeaveType::Sick, 'start_date' => '2026-10-13', 'end_date' => '2026-10-14',
        'created_at' => '2026-10-12 00:39:00',
    ]);
    $old = LeaveRequest::factory()->for($dewi, 'intern')->create([
        'type' => LeaveType::Urgent, 'start_date' => '2026-10-13', 'end_date' => '2026-10-13',
        'created_at' => '2026-10-11 12:39:00',
    ]);
    $exactly = LeaveRequest::factory()->for($andi, 'intern')->create(['created_at' => '2026-10-11 14:39:00']);
    LeaveRequest::factory()->for($andi, 'intern')->create(['status' => RequestStatus::Approved]);
    LeaveRequest::factory()->for(User::factory()->intern()->create(), 'intern')->create();

    mentorDashboard($this->mentor)
        ->assertOk()
        ->assertJsonPath('data.pending_leaves.total', 3)
        ->assertJsonPath('data.pending_leaves.items.0', [
            'id' => $old->id,
            'intern' => ['id' => $dewi->id, 'name' => 'Dewi Sartika', 'short_name' => 'Dewi S.'],
            'type' => 'urgent',
            'start_date' => '2026-10-13',
            'end_date' => '2026-10-13',
            'created_at' => '2026-10-11T12:39:00+07:00',
            'pending_hours' => 26,
            'is_overdue' => true,
        ])
        ->assertJsonPath('data.pending_leaves.items.1.id', $exactly->id)
        ->assertJsonPath('data.pending_leaves.items.1.pending_hours', 24)
        ->assertJsonPath('data.pending_leaves.items.1.is_overdue', false)
        ->assertJsonPath('data.pending_leaves.items.2.id', $recent->id)
        ->assertJsonPath('data.pending_leaves.items.2.pending_hours', 14);
});

it('shows the three latest announcements for mentors', function () {
    Announcement::factory()->create(['title' => 'Khusus intern', 'for_mentor' => false, 'created_at' => '2026-10-12 09:00:00']);
    foreach (['Lama', 'Tengah', 'Baru', 'Terbaru'] as $i => $title) {
        Announcement::factory()->create(['title' => $title, 'created_at' => "2026-10-0{$i} 09:00:00"]);
    }

    $titles = collect(mentorDashboard($this->mentor)->assertOk()->json('data.announcements'))->pluck('title');

    expect($titles->all())->toBe(['Terbaru', 'Baru', 'Tengah']);
});

it('rejects interns and admins from the mentor dashboard', function (string $role) {
    mentorDashboard(User::factory()->{$role}()->create())
        ->assertForbidden()
        ->assertJsonPath('message', 'Anda tidak memiliki akses.');
})->with(['intern', 'admin']);

it('rejects a mentor who has not changed the temporary password', function () {
    mentorDashboard(User::factory()->mentor()->mustChangePassword()->create())
        ->assertForbidden()
        ->assertJsonPath('must_change_password', true);
});
