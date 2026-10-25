<?php

use App\Enums\TaskStatus;
use App\Models\Holiday;
use App\Models\Notification;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskRead;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->mentor = User::factory()->mentor()->create(['name' => 'Bu Sari']);
    $this->andi = boardIntern($this->mentor, 'Andi Pratama');
    $this->rina = boardIntern($this->mentor, 'Rina Wulandari');
});

function boardIntern(User $mentor, string $name, array $attributes = []): User
{
    return User::factory()->intern([
        'mentor_id' => $mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create(['name' => $name, ...$attributes]);
}

function boardTask(User $mentor, User $intern, array $attributes = []): Task
{
    return Task::factory()->create(['mentor_id' => $mentor->id, 'intern_id' => $intern->id, ...$attributes]);
}

function taskBoard(User $mentor, string $query = ''): TestResponse
{
    return test()->getJson('/api/mentor/tasks'.$query, ['Authorization' => 'Bearer '.$mentor->createToken('api')->plainTextToken]);
}

describe('Kanban dan Daftar', function () {
    it('lists the tasks this mentor holds, nearest due first, as cards', function () {
        $review = boardTask($this->mentor, $this->rina, [
            'title' => 'Laporan API', 'status' => TaskStatus::InReview,
            'due_at' => '2026-10-11 17:00:00', 'submitted_at' => '2026-10-12 09:00:00',
        ]);
        $todo = boardTask($this->mentor, $this->andi, ['title' => 'Uji login', 'due_at' => '2026-10-15 17:00:00']);
        Task::factory()->create(['due_at' => '2026-10-13 17:00:00']);

        taskBoard($this->mentor)
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.hidden_done', 0)
            ->assertJsonPath('data.0.id', $review->id)
            ->assertJsonPath('data.0.is_late', true)
            ->assertJsonPath('data.0.late_label', null)
            ->assertJsonPath('data.0.action', 'review')
            ->assertJsonPath('data.0.can_drag', true)
            ->assertJsonPath('data.0.submitted_at', '2026-10-12T09:00:00+07:00')
            ->assertJsonPath('data.1.id', $todo->id)
            ->assertJsonPath('data.1.intern', ['id' => $this->andi->id, 'name' => 'Andi Pratama', 'short_name' => 'Andi P.'])
            ->assertJsonPath('data.1.action', 'open')
            ->assertJsonPath('data.1.can_drag', false)
            ->assertJsonPath('data.1.can_edit', true)
            ->assertJsonPath('data.1.can_delete', true)
            ->assertJsonPath('data.1.unread_comments', 0);
    });

    it('marks late tasks that are not submitted with how late they are', function () {
        boardTask($this->mentor, $this->andi, ['status' => TaskStatus::InProgress, 'due_at' => '2026-10-10 14:00:00']);

        taskBoard($this->mentor)
            ->assertOk()
            ->assertJsonPath('data.0.is_late', true)
            ->assertJsonPath('data.0.late_label', 'Lewat 2 hari');
    });

    it('counts unread comments from the intern for the mentor', function () {
        $task = boardTask($this->mentor, $this->andi);
        TaskComment::factory()->for($task)->create(['user_id' => $this->andi->id, 'created_at' => '2026-10-12 09:00:00']);
        TaskComment::factory()->for($task)->create(['user_id' => $this->andi->id, 'created_at' => '2026-10-12 11:00:00']);
        TaskComment::factory()->for($task)->create(['user_id' => $this->mentor->id, 'created_at' => '2026-10-12 12:00:00']);
        TaskRead::query()->create(['task_id' => $task->id, 'user_id' => $this->mentor->id, 'last_read_at' => '2026-10-12 10:00:00']);

        taskBoard($this->mentor)
            ->assertOk()
            ->assertJsonPath('data.0.unread_comments', 1)
            ->assertJsonPath('data.0.can_delete', false);
    });

    it('hides done tasks older than 30 days unless asked', function () {
        boardTask($this->mentor, $this->andi, ['status' => TaskStatus::Done, 'done_at' => '2026-09-01 10:00:00']);
        $recent = boardTask($this->mentor, $this->andi, ['status' => TaskStatus::Done, 'done_at' => '2026-10-08 10:00:00']);

        taskBoard($this->mentor)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $recent->id)
            ->assertJsonPath('data.0.action', 'view')
            ->assertJsonPath('data.0.can_edit', false)
            ->assertJsonPath('meta.hidden_done', 1);

        taskBoard($this->mentor, '?include_older_done=1')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.hidden_done', 0);
    });

    it('filters by intern, status, late mark, due range, and title', function (string $query, array $titles) {
        boardTask($this->mentor, $this->andi, ['title' => 'Desain ERD', 'status' => TaskStatus::InProgress, 'due_at' => '2026-10-14 17:00:00']);
        boardTask($this->mentor, $this->andi, ['title' => 'Uji login', 'due_at' => '2026-10-10 17:00:00']);
        boardTask($this->mentor, $this->rina, ['title' => 'Laporan API', 'status' => TaskStatus::InReview, 'due_at' => '2026-10-20 17:00:00', 'submitted_at' => '2026-10-12 09:00:00']);

        $response = taskBoard($this->mentor, $query)->assertOk();

        expect(collect($response->json('data'))->pluck('title')->all())->toBe($titles);
    })->with([
        'intern' => [fn () => '?intern_id='.test()->rina->id, ['Laporan API']],
        'status' => ['?status=in_progress', ['Desain ERD']],
        'terlambat' => ['?late=1', ['Uji login']],
        'rentang tenggat' => ['?due_from=2026-10-11&due_to=2026-10-15', ['Desain ERD']],
        'judul' => ['?q=LOGIN', ['Uji login']],
    ]);

    it('sorts by newest created or intern name', function () {
        $this->travelTo(Carbon::parse('2026-10-10 09:00:00'));
        boardTask($this->mentor, $this->rina, ['title' => 'Lama', 'due_at' => '2026-10-13 17:00:00']);
        $this->travelTo(Carbon::parse('2026-10-11 09:00:00'));
        boardTask($this->mentor, $this->andi, ['title' => 'Baru', 'due_at' => '2026-10-20 17:00:00']);
        $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

        expect(collect(taskBoard($this->mentor, '?sort=newest')->json('data'))->pluck('title')->all())->toBe(['Baru', 'Lama'])
            ->and(collect(taskBoard($this->mentor, '?sort=intern')->json('data'))->pluck('title')->all())->toBe(['Baru', 'Lama'])
            ->and(collect(taskBoard($this->mentor)->json('data'))->pluck('title')->all())->toBe(['Lama', 'Baru']);
    });

    it('rejects invalid filters', function (string $query) {
        taskBoard($this->mentor, $query)->assertUnprocessable();
    })->with(['?status=selesai', '?sort=judul', '?due_from=12-10-2026', '?due_from=2026-10-15&due_to=2026-10-14']);

    it('rejects interns and admins', function (string $role) {
        taskBoard(User::factory()->{$role}()->create())->assertForbidden();
    })->with(['intern', 'admin']);
});

describe('pengingat Task lewat tenggat lebih dari 2 hari kerja', function () {
    it('reminds the mentor once on the third working day after the due date', function () {
        // Tenggat Jumat 9 Okt; Senin 12 dan Selasa 13 baru 2 hari kerja.
        $task = boardTask($this->mentor, $this->andi, ['title' => 'Dokumen', 'status' => TaskStatus::InProgress, 'due_at' => '2026-10-09 17:00:00']);

        $this->travelTo(Carbon::parse('2026-10-13 07:00:00'));
        $this->artisan('app:remind-overdue-tasks')->assertSuccessful();
        expect(Notification::count())->toBe(0);

        $this->travelTo(Carbon::parse('2026-10-14 07:00:00'));
        $this->artisan('app:remind-overdue-tasks')->expectsOutput('1 pengingat Task terlambat dikirim.')->assertSuccessful();

        $notification = Notification::sole();
        expect($notification->user_id)->toBe($this->mentor->id)
            ->and($notification->text)->toBe("Task 'Dokumen' milik Andi P. lewat tenggat lebih dari 2 hari kerja.")
            ->and($notification->link_path)->toBe('/task')
            ->and($notification->link_params)->toBe(['open' => $task->id])
            ->and($task->fresh()->overdue_reminded_at)->not->toBeNull();

        $this->travelTo(Carbon::parse('2026-10-15 07:00:00'));
        $this->artisan('app:remind-overdue-tasks')->assertSuccessful();
        expect(Notification::count())->toBe(1);
    });

    it('does not count weekends and holidays as working days', function () {
        Holiday::factory()->create(['date' => '2026-10-14', 'name' => 'Libur Nasional']);
        boardTask($this->mentor, $this->andi, ['due_at' => '2026-10-09 17:00:00']);

        $this->travelTo(Carbon::parse('2026-10-14 07:00:00'));
        $this->artisan('app:remind-overdue-tasks')->assertSuccessful();
        expect(Notification::count())->toBe(0);

        $this->travelTo(Carbon::parse('2026-10-15 07:00:00'));
        $this->artisan('app:remind-overdue-tasks')->assertSuccessful();
        expect(Notification::count())->toBe(1);
    });

    it('skips submitted, done, and inactive interns\' tasks', function () {
        boardTask($this->mentor, $this->andi, ['status' => TaskStatus::InReview, 'due_at' => '2026-10-01 17:00:00', 'submitted_at' => '2026-10-05 09:00:00']);
        boardTask($this->mentor, $this->andi, ['status' => TaskStatus::Done, 'due_at' => '2026-10-01 17:00:00']);
        $inactive = boardIntern($this->mentor, 'Nonaktif', ['is_active' => false]);
        boardTask($this->mentor, $inactive, ['due_at' => '2026-10-01 17:00:00']);

        $this->artisan('app:remind-overdue-tasks')->assertSuccessful();

        expect(Notification::count())->toBe(0);
    });

    it('reminds again after the mentor moves the due date', function () {
        $task = boardTask($this->mentor, $this->andi, ['due_at' => '2026-10-01 17:00:00', 'overdue_reminded_at' => '2026-10-06 07:00:00']);

        $this->putJson("/api/mentor/tasks/{$task->id}", [
            'title' => $task->title, 'description' => $task->description, 'due_at' => '2026-10-13 17:00',
        ], ['Authorization' => 'Bearer '.$this->mentor->createToken('api')->plainTextToken])->assertOk();

        expect($task->fresh()->overdue_reminded_at)->toBeNull();
    });

    it('is scheduled every morning', function () {
        $this->artisan('schedule:list')->expectsOutputToContain('app:remind-overdue-tasks')->assertSuccessful();
    });
});
