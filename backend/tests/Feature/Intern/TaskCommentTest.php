<?php

use App\Enums\TaskStatus;
use App\Models\Notification;
use App\Models\Task;
use App\Models\TaskComment;
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
    ])->create(['name' => 'Rina Wulandari']);
    $this->token = $this->intern->createToken('api')->plainTextToken;
    $this->task = Task::factory()->for($this->intern, 'intern')->for($this->mentor, 'mentor')->create([
        'title' => 'Laporan API',
        'status' => TaskStatus::InProgress,
    ]);
});

function comment(array $data, ?Task $task = null)
{
    $task ??= test()->task;

    return test()->postJson("/api/intern/tasks/{$task->id}/comments", $data, [
        'Authorization' => 'Bearer '.test()->token,
    ]);
}

it('adds a reply to the thread', function () {
    comment(['body' => 'Baik Bu, relasinya sudah saya tambahkan.'])
        ->assertCreated()
        ->assertJsonPath('data.author', ['id' => $this->intern->id, 'name' => 'Rina Wulandari', 'role' => 'intern'])
        ->assertJsonPath('data.body', 'Baik Bu, relasinya sudah saya tambahkan.')
        ->assertJsonPath('data.is_revision', false)
        ->assertJsonPath('data.created_at', '2026-10-12T14:39:00+07:00');

    $comment = TaskComment::sole();
    expect($comment->task_id)->toBe($this->task->id)
        ->and($comment->user_id)->toBe($this->intern->id);
});

it('notifies the mentor and links to the thread', function () {
    comment(['body' => 'Sudah saya perbaiki.'])->assertCreated();

    $notification = Notification::sole();
    expect($notification->user_id)->toBe($this->mentor->id)
        ->and($notification->text)->toBe("Rina W. membalas komentar di 'Laporan API'.")
        ->and($notification->link_path)->toBe('/task')
        ->and($notification->link_params)->toBe(['open' => $this->task->id, 'to' => 'comments']);
});

it('keeps the thread in order and does not count the intern’s own reply as unread', function () {
    TaskComment::factory()->for($this->task)->create([
        'user_id' => $this->mentor->id,
        'body' => 'Relasi izin ke intern belum ada.',
        'created_at' => '2026-10-12 10:00:00',
    ]);

    comment(['body' => 'Sudah saya tambahkan.'])->assertCreated();

    $this->getJson('/api/intern/tasks', ['Authorization' => 'Bearer '.$this->token])
        ->assertJsonPath('data.0.unread_comments', 0);

    $thread = $this->getJson("/api/intern/tasks/{$this->task->id}", ['Authorization' => 'Bearer '.$this->token])
        ->json('data.comments');

    expect(array_column($thread, 'body'))->toBe(['Relasi izin ke intern belum ada.', 'Sudah saya tambahkan.']);
});

it('allows comments on every status except done', function (TaskStatus $status) {
    $this->task->update(['status' => $status]);

    comment(['body' => 'Pertanyaan soal Task ini.'])->assertCreated();
})->with([TaskStatus::Todo, TaskStatus::InProgress, TaskStatus::InReview]);

it('locks the thread when the task is done', function () {
    $this->task->update(['status' => TaskStatus::Done]);

    comment(['body' => 'Terima kasih, Bu.'])
        ->assertUnprocessable()
        ->assertExactJson(['message' => 'Task sudah selesai dan terkunci.', 'reason' => 'done_locked']);

    expect(TaskComment::count())->toBe(0)
        ->and(Notification::count())->toBe(0);
});

it('rejects an empty comment', function (array $data) {
    comment($data)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['body' => 'Tulis komentar dulu.']);
})->with([
    'tanpa isi' => [[]],
    'hanya spasi' => [['body' => '   ']],
]);

it('has no way to edit or delete a comment', function () {
    $comment = TaskComment::factory()->for($this->task)->create(['user_id' => $this->intern->id]);

    $headers = ['Authorization' => 'Bearer '.$this->token];
    $this->putJson("/api/intern/tasks/{$this->task->id}/comments/{$comment->id}", ['body' => 'Diubah'], $headers)->assertNotFound();
    $this->deleteJson("/api/intern/tasks/{$this->task->id}/comments/{$comment->id}", [], $headers)->assertNotFound();
});

it('rejects comments on other interns’ tasks', function () {
    $other = Task::factory()->create();

    comment(['body' => 'Halo.'], $other)->assertForbidden();

    expect(TaskComment::count())->toBe(0);
});

it('rejects mentors and admins on the intern endpoint', function (string $role) {
    $user = User::factory()->{$role}()->create();

    $this->postJson("/api/intern/tasks/{$this->task->id}/comments", ['body' => 'Halo.'], [
        'Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken,
    ])->assertForbidden();
})->with(['mentor', 'admin']);

it('rejects requests without a token', function () {
    $this->postJson("/api/intern/tasks/{$this->task->id}/comments", ['body' => 'Halo.'])->assertUnauthorized();
});
