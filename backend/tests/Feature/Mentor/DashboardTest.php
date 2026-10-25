<?php

use App\Enums\LeaveType;
use App\Enums\RequestStatus;
use App\Enums\TaskStatus;
use App\Models\Announcement;
use App\Models\Attendance;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskRead;
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

function taskFor(User $mentor, User $intern, array $attributes = []): Task
{
    return Task::factory()->create([
        'mentor_id' => $mentor->id,
        'intern_id' => $intern->id,
        ...$attributes,
    ]);
}

it('tells the frontend when the mentor has no interns yet', function () {
    mentorDashboard($this->mentor)
        ->assertOk()
        ->assertJsonPath('data.date', '2026-10-12')
        ->assertJsonPath('data.holiday', null)
        ->assertJsonPath('data.interns_total', 0)
        ->assertJsonPath('data.today', ['interns' => 0, 'clocked_in' => 0, 'on_leave' => 0, 'not_clocked_in' => 0])
        ->assertJsonPath('data.review_tasks', ['total' => 0, 'items' => []])
        ->assertJsonPath('data.pending_leaves', ['total' => 0, 'items' => []])
        ->assertJsonPath('data.unread_comments', ['total' => 0, 'items' => []])
        ->assertJsonPath('data.late_tasks', ['total' => 0, 'items' => []]);
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

it('lists tasks in review, longest waiting first', function () {
    $andi = menteeOf($this->mentor, 'Andi Pratama');
    $rina = menteeOf($this->mentor, 'Rina Wulandari');

    $late = taskFor($this->mentor, $rina, [
        'title' => 'Laporan API', 'status' => TaskStatus::InReview,
        'due_at' => '2026-10-10 17:00:00', 'submitted_at' => '2026-10-11 09:00:00',
    ]);
    $first = taskFor($this->mentor, $andi, [
        'title' => 'Desain ERD', 'status' => TaskStatus::InReview,
        'due_at' => '2026-10-15 17:00:00', 'submitted_at' => '2026-10-09 10:00:00',
    ]);
    taskFor($this->mentor, $andi, ['status' => TaskStatus::InProgress]);
    Task::factory()->status(TaskStatus::InReview)->create(['submitted_at' => '2026-10-01 10:00:00']);

    mentorDashboard($this->mentor)
        ->assertOk()
        ->assertJsonPath('data.review_tasks.total', 2)
        ->assertJsonPath('data.review_tasks.items.0', [
            'id' => $first->id,
            'code' => $first->code,
            'title' => 'Desain ERD',
            'intern' => ['id' => $andi->id, 'name' => 'Andi Pratama', 'short_name' => 'Andi P.'],
            'submitted_at' => '2026-10-09T10:00:00+07:00',
            'is_late' => false,
        ])
        ->assertJsonPath('data.review_tasks.items.1.id', $late->id)
        ->assertJsonPath('data.review_tasks.items.1.is_late', true);
});

it('shows at most five rows per box but the full total', function () {
    $andi = menteeOf($this->mentor, 'Andi Pratama');

    foreach (range(1, 7) as $i) {
        taskFor($this->mentor, $andi, [
            'status' => TaskStatus::InReview,
            'due_at' => '2026-10-20 17:00:00',
            'submitted_at' => "2026-10-0{$i} 09:00:00",
        ]);
    }

    $response = mentorDashboard($this->mentor)->assertOk()->assertJsonPath('data.review_tasks.total', 7);

    expect($response->json('data.review_tasks.items'))->toHaveCount(5);
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

it('lists tasks with intern comments the mentor has not read', function () {
    $doni = menteeOf($this->mentor, 'Doni Andika');
    $task = taskFor($this->mentor, $doni, ['title' => 'Uji login', 'status' => TaskStatus::InProgress]);
    $read = taskFor($this->mentor, $doni, ['title' => 'Sudah dibaca']);
    $own = taskFor($this->mentor, $doni, ['title' => 'Komentar sendiri']);

    TaskComment::factory()->for($task)->create(['user_id' => $doni->id, 'created_at' => '2026-10-12 09:00:00']);
    TaskComment::factory()->for($task)->create(['user_id' => $doni->id, 'created_at' => '2026-10-12 10:00:00']);

    TaskComment::factory()->for($read)->create(['user_id' => $doni->id, 'created_at' => '2026-10-12 09:00:00']);
    TaskRead::query()->create(['task_id' => $read->id, 'user_id' => $this->mentor->id, 'last_read_at' => '2026-10-12 11:00:00']);

    TaskComment::factory()->for($own)->create(['user_id' => $this->mentor->id]);

    mentorDashboard($this->mentor)
        ->assertOk()
        ->assertJsonPath('data.unread_comments.total', 1)
        ->assertJsonPath('data.unread_comments.items.0', [
            'id' => $task->id,
            'code' => $task->code,
            'title' => 'Uji login',
            'intern' => ['id' => $doni->id, 'name' => 'Doni Andika', 'short_name' => 'Doni A.'],
            'status' => 'in_progress',
            'unread_comments' => 2,
        ]);
});

it('counts a comment as new again when it arrives after the last read', function () {
    $doni = menteeOf($this->mentor, 'Doni Andika');
    $task = taskFor($this->mentor, $doni);

    TaskRead::query()->create(['task_id' => $task->id, 'user_id' => $this->mentor->id, 'last_read_at' => '2026-10-12 11:00:00']);
    TaskComment::factory()->for($task)->create(['user_id' => $doni->id, 'created_at' => '2026-10-12 09:00:00']);
    TaskComment::factory()->for($task)->create(['user_id' => $doni->id, 'created_at' => '2026-10-12 12:00:00']);

    mentorDashboard($this->mentor)
        ->assertOk()
        ->assertJsonPath('data.unread_comments.total', 1)
        ->assertJsonPath('data.unread_comments.items.0.unread_comments', 1);
});

it('lists late tasks that are not done, oldest due date first', function () {
    $budi = menteeOf($this->mentor, 'Budi Kurnia');

    $todo = taskFor($this->mentor, $budi, ['title' => 'Dokumen', 'status' => TaskStatus::Todo, 'due_at' => '2026-10-10 14:00:00']);
    $progress = taskFor($this->mentor, $budi, ['status' => TaskStatus::InProgress, 'due_at' => '2026-10-12 12:00:00']);
    $reviewLate = taskFor($this->mentor, $budi, [
        'status' => TaskStatus::InReview, 'due_at' => '2026-10-08 17:00:00', 'submitted_at' => '2026-10-09 18:00:00',
    ]);
    taskFor($this->mentor, $budi, ['status' => TaskStatus::InReview, 'due_at' => '2026-10-11 17:00:00', 'submitted_at' => '2026-10-11 10:00:00']);
    taskFor($this->mentor, $budi, ['status' => TaskStatus::Done, 'due_at' => '2026-10-01 17:00:00', 'done_at' => '2026-10-05 09:00:00']);
    taskFor($this->mentor, $budi, ['status' => TaskStatus::Todo, 'due_at' => '2026-10-13 17:00:00']);

    mentorDashboard($this->mentor)
        ->assertOk()
        ->assertJsonPath('data.late_tasks.total', 3)
        ->assertJsonPath('data.late_tasks.items.0.id', $reviewLate->id)
        ->assertJsonPath('data.late_tasks.items.0.status', 'in_review')
        ->assertJsonPath('data.late_tasks.items.0.late_label', 'Lewat 1 hari')
        ->assertJsonPath('data.late_tasks.items.1', [
            'id' => $todo->id,
            'code' => $todo->code,
            'title' => 'Dokumen',
            'intern' => ['id' => $budi->id, 'name' => 'Budi Kurnia', 'short_name' => 'Budi K.'],
            'status' => 'todo',
            'due_at' => '2026-10-10T14:00:00+07:00',
            'late_label' => 'Lewat 2 hari',
        ])
        ->assertJsonPath('data.late_tasks.items.2.id', $progress->id)
        ->assertJsonPath('data.late_tasks.items.2.late_label', 'Lewat 2 jam');
});

it('keeps showing tasks of an inactive intern so the mentor can still review them', function () {
    $intern = menteeOf($this->mentor, 'Rina Wulandari', attributes: ['is_active' => false]);
    taskFor($this->mentor, $intern, ['status' => TaskStatus::InReview, 'submitted_at' => '2026-10-11 10:00:00']);

    mentorDashboard($this->mentor)->assertOk()->assertJsonPath('data.review_tasks.total', 1);
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
