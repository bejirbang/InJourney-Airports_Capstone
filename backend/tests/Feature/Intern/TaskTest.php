<?php

use App\Enums\TaskStatus;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskRead;
use App\Models\User;
use Illuminate\Support\Carbon;

// Senin, 12 Oktober 2026 pukul 14:39.
beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->intern = User::factory()->intern([
        'mentor_id' => $this->mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create();
    $this->token = $this->intern->createToken('api')->plainTextToken;
});

function task(array $attributes = []): Task
{
    return Task::factory()->for(test()->intern, 'intern')->for(test()->mentor, 'mentor')->create($attributes);
}

function asTaskIntern(string $method, string $uri, array $data = [])
{
    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.test()->token]);
}

it('lists the intern’s tasks by nearest deadline with mentor, status, and late mark', function () {
    task(['title' => 'Uji login', 'due_at' => '2026-10-15 17:00:00']);
    task(['title' => 'Desain ERD', 'status' => TaskStatus::InProgress, 'due_at' => '2026-10-14 17:00:00']);
    task(['title' => 'Laporan API', 'status' => TaskStatus::InProgress, 'due_at' => '2026-10-10 17:00:00']);
    Task::factory()->create(['title' => 'Milik intern lain']);

    $response = asTaskIntern('GET', '/api/intern/tasks')->assertOk();

    expect(array_column($response->json('data'), 'title'))->toBe(['Laporan API', 'Desain ERD', 'Uji login']);

    $response
        ->assertJsonPath('data.0.mentor', ['id' => $this->mentor->id, 'name' => 'Sari Wijaya'])
        ->assertJsonPath('data.0.status', 'in_progress')
        ->assertJsonPath('data.0.due_at', '2026-10-10T17:00:00+07:00')
        ->assertJsonPath('data.0.is_late', true)
        ->assertJsonPath('data.0.late_label', 'Lewat 1 hari')
        ->assertJsonPath('data.0.action', 'submit')
        ->assertJsonPath('data.1.is_late', false)
        ->assertJsonPath('data.1.late_label', null)
        ->assertJsonPath('data.2.action', 'start')
        ->assertJsonPath('meta.hidden_done', 0);
});

it('labels lateness in hours under a day', function () {
    task(['due_at' => '2026-10-12 09:00:00']);

    asTaskIntern('GET', '/api/intern/tasks')->assertJsonPath('data.0.late_label', 'Lewat 5 jam');
});

it('marks in-review tasks late only when submitted after the deadline', function () {
    task(['title' => 'Tepat waktu', 'status' => TaskStatus::InReview, 'due_at' => '2026-10-10 17:00:00', 'submitted_at' => '2026-10-10 09:00:00']);
    task(['title' => 'Telat kumpul', 'status' => TaskStatus::InReview, 'due_at' => '2026-10-08 17:00:00', 'submitted_at' => '2026-10-09 09:00:00']);

    $tasks = collect(asTaskIntern('GET', '/api/intern/tasks')->json('data'))->keyBy('title');

    expect($tasks['Tepat waktu']['is_late'])->toBeFalse()
        ->and($tasks['Telat kumpul']['is_late'])->toBeTrue()
        ->and($tasks['Telat kumpul']['action'])->toBe('replace');
});

it('filters by status, late mark, and title, and sorts by newest', function () {
    task(['title' => 'Desain ERD', 'status' => TaskStatus::InProgress, 'due_at' => '2026-10-10 17:00:00', 'created_at' => '2026-10-01 08:00:00']);
    task(['title' => 'Uji login', 'due_at' => '2026-10-15 17:00:00', 'created_at' => '2026-10-05 08:00:00']);
    task(['title' => 'Desain halaman', 'due_at' => '2026-10-20 17:00:00', 'created_at' => '2026-10-03 08:00:00']);

    $titles = fn (string $query) => array_column(asTaskIntern('GET', "/api/intern/tasks?{$query}")->assertOk()->json('data'), 'title');

    expect($titles('status=todo'))->toBe(['Uji login', 'Desain halaman'])
        ->and($titles('late=1'))->toBe(['Desain ERD'])
        ->and($titles('q=desain'))->toBe(['Desain ERD', 'Desain halaman'])
        ->and($titles('sort=newest'))->toBe(['Uji login', 'Desain halaman', 'Desain ERD']);
});

it('hides done tasks older than 30 days unless asked', function () {
    task(['title' => 'Selesai baru', 'status' => TaskStatus::Done, 'done_at' => '2026-10-08 10:00:00']);
    task(['title' => 'Selesai lama', 'status' => TaskStatus::Done, 'done_at' => '2026-09-01 10:00:00']);

    $default = asTaskIntern('GET', '/api/intern/tasks')->assertJsonPath('meta.hidden_done', 1);
    expect(array_column($default->json('data'), 'title'))->toBe(['Selesai baru'])
        ->and($default->json('data.0.action'))->toBeNull()
        ->and($default->json('data.0.is_late'))->toBeFalse();

    $all = asTaskIntern('GET', '/api/intern/tasks?include_older_done=1')->assertJsonPath('meta.hidden_done', 0);
    expect($all->json('data'))->toHaveCount(2);
});

it('returns an empty list when the mentor has not given any task', function () {
    asTaskIntern('GET', '/api/intern/tasks')->assertOk()->assertExactJson(['data' => [], 'meta' => ['hidden_done' => 0]]);
});

it('rejects an invalid filter', function () {
    asTaskIntern('GET', '/api/intern/tasks?status=selesai')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status' => 'Filter Task tidak valid.']);
});

it('counts only unread comments from others and clears them when the detail is opened', function () {
    $task = task(['status' => TaskStatus::InProgress]);
    TaskComment::factory()->for($task)->create(['user_id' => $this->mentor->id, 'created_at' => '2026-10-10 09:00:00']);
    TaskComment::factory()->for($task)->create(['user_id' => $this->intern->id, 'created_at' => '2026-10-11 09:00:00']);
    TaskComment::factory()->for($task)->create(['user_id' => $this->mentor->id, 'created_at' => '2026-10-12 10:00:00', 'is_revision' => true]);
    TaskRead::query()->create(['task_id' => $task->id, 'user_id' => $this->intern->id, 'last_read_at' => '2026-10-11 09:30:00']);

    asTaskIntern('GET', '/api/intern/tasks')->assertJsonPath('data.0.unread_comments', 1);

    $detail = asTaskIntern('GET', "/api/intern/tasks/{$task->id}")->assertOk();
    expect(array_column($detail->json('data.comments'), 'is_unread'))->toBe([false, false, true]);

    asTaskIntern('GET', '/api/intern/tasks')->assertJsonPath('data.0.unread_comments', 0);
});

it('shows the detail with description, submission, revise banner, and the comment thread', function () {
    $task = task([
        'title' => 'Desain ERD',
        'description' => 'Rancang ERD untuk modul absensi dan izin.',
        'status' => TaskStatus::InProgress,
        'submission_link' => 'https://drive.example.com/erd',
        'submitted_at' => '2026-10-09 15:00:00',
        'ever_submitted' => true,
        'revise_pending' => true,
    ]);
    TaskComment::factory()->for($task)->create([
        'user_id' => $this->mentor->id,
        'body' => 'Relasi izin ke intern belum ada, tolong tambahkan.',
        'is_revision' => true,
        'created_at' => '2026-10-12 10:00:00',
    ]);

    asTaskIntern('GET', "/api/intern/tasks/{$task->id}")
        ->assertOk()
        ->assertJsonPath('data.description', 'Rancang ERD untuk modul absensi dan izin.')
        ->assertJsonPath('data.revise_pending', true)
        ->assertJsonPath('data.submission', [
            'link' => 'https://drive.example.com/erd',
            'has_file' => false,
            'submitted_at' => '2026-10-09T15:00:00+07:00',
        ])
        ->assertJsonPath('data.can_comment', true)
        ->assertJsonPath('data.comments.0.author', ['id' => $this->mentor->id, 'name' => 'Sari Wijaya', 'role' => 'mentor'])
        ->assertJsonPath('data.comments.0.body', 'Relasi izin ke intern belum ada, tolong tambahkan.')
        ->assertJsonPath('data.comments.0.is_revision', true)
        ->assertJsonPath('data.comments.0.is_unread', true);
});

it('locks the thread on done tasks and shows no submission before one is made', function () {
    $done = task(['status' => TaskStatus::Done, 'done_at' => '2026-10-11 10:00:00']);
    $todo = task();

    asTaskIntern('GET', "/api/intern/tasks/{$done->id}")->assertJsonPath('data.can_comment', false);
    asTaskIntern('GET', "/api/intern/tasks/{$todo->id}")->assertJsonPath('data.submission', null)->assertJsonPath('data.comments', []);
});

it('starts a task and moves it back while it was never submitted', function () {
    $task = task();

    asTaskIntern('POST', "/api/intern/tasks/{$task->id}/move", ['to' => 'in_progress', 'from' => 'todo'])
        ->assertOk()
        ->assertJsonPath('data.status', 'in_progress')
        ->assertJsonPath('data.action', 'submit');

    asTaskIntern('POST', "/api/intern/tasks/{$task->id}/move", ['to' => 'todo'])
        ->assertOk()
        ->assertJsonPath('data.status', 'todo');
});

it('rejects moves that are not allowed for an intern', function (array $attributes, string $to, string $message, string $reason) {
    $task = task($attributes);

    asTaskIntern('POST', "/api/intern/tasks/{$task->id}/move", ['to' => $to])
        ->assertUnprocessable()
        ->assertExactJson(['message' => $message, 'reason' => $reason]);

    expect($task->refresh()->status->value)->toBe($attributes['status']->value ?? 'todo');
})->with([
    'To Do ke In Review' => [[], 'in_review', 'Mulai kerjakan Task dulu sebelum mengumpulkan.', 'not_started'],
    'In Progress ke In Review tanpa hasil' => [['status' => TaskStatus::InProgress], 'in_review', 'Kumpulkan hasil untuk memindahkan Task ke In Review.', 'submission_required'],
    'pernah dikumpulkan ke To Do' => [['status' => TaskStatus::InProgress, 'ever_submitted' => true], 'todo', 'Task yang pernah dikumpulkan tidak bisa kembali ke To Do.', 'ever_submitted'],
    'In Review terkunci' => [['status' => TaskStatus::InReview], 'in_progress', 'Task sedang diperiksa mentor.', 'in_review_locked'],
    'Done terkunci' => [['status' => TaskStatus::Done], 'in_progress', 'Task sudah selesai dan terkunci.', 'done_locked'],
    'ke Done' => [['status' => TaskStatus::InProgress], 'done', 'Hanya mentor yang bisa menandai Done lewat Accept.', 'mentor_only'],
]);

it('rejects a drag when the mentor already changed the status', function () {
    // Intern melihat In Progress, tetapi mentor sudah memindahkannya (misalnya lewat Revise ke status lain).
    $task = task(['status' => TaskStatus::InReview]);

    asTaskIntern('POST', "/api/intern/tasks/{$task->id}/move", ['to' => 'todo', 'from' => 'in_progress'])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Status Task sudah berubah. Muat ulang.')
        ->assertJsonPath('reason', 'stale');
});

it('treats a move to the same status as no change', function () {
    $task = task(['status' => TaskStatus::InProgress]);

    asTaskIntern('POST', "/api/intern/tasks/{$task->id}/move", ['to' => 'in_progress'])
        ->assertOk()
        ->assertJsonPath('data.status', 'in_progress');
});

it('validates the target status', function () {
    $task = task();

    asTaskIntern('POST', "/api/intern/tasks/{$task->id}/move", ['to' => 'selesai'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['to' => 'Status tujuan tidak valid.']);
});

it('hides other interns’ tasks', function () {
    $other = Task::factory()->create();

    asTaskIntern('GET', "/api/intern/tasks/{$other->id}")->assertForbidden();
    asTaskIntern('POST', "/api/intern/tasks/{$other->id}/move", ['to' => 'in_progress'])->assertForbidden();

    expect($other->refresh()->status)->toBe(TaskStatus::Todo);
});

it('rejects mentors and admins', function (string $role) {
    $user = User::factory()->{$role}()->create();

    $this->getJson('/api/intern/tasks', ['Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken])
        ->assertForbidden();
})->with(['mentor', 'admin']);

it('rejects requests without a token', function () {
    $this->getJson('/api/intern/tasks')->assertUnauthorized();
});
