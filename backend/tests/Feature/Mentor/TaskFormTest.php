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

// "Hari ini" sama dengan prototipe frontend: Senin, 12 Oktober 2026 pukul 14:39.
beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->mentor = User::factory()->mentor()->create(['name' => 'Bu Sari']);
    $this->intern = User::factory()->intern([
        'mentor_id' => $this->mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create(['name' => 'Andi Pratama']);
});

function mentorRequest(User $mentor, string $method, string $uri, array $data = []): TestResponse
{
    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$mentor->createToken('api')->plainTextToken]);
}

function validTask(array $overrides = []): array
{
    return [
        'intern_id' => test()->intern->id,
        'title' => 'Desain ERD',
        'description' => 'Buat ERD untuk modul absensi.',
        'due_at' => '2026-10-15 17:00',
        ...$overrides,
    ];
}

function mentorTask(User $mentor, User $intern, array $attributes = []): Task
{
    return Task::factory()->create(['mentor_id' => $mentor->id, 'intern_id' => $intern->id, ...$attributes]);
}

describe('Buat Task', function () {
    it('creates a To Do task for one active intern and notifies the intern', function () {
        $response = mentorRequest($this->mentor, 'POST', '/api/mentor/tasks', validTask())
            ->assertCreated()
            ->assertJsonPath('message', 'Task dibuat. Intern sudah diberi tahu.')
            ->assertJsonPath('warning', null)
            ->assertJsonPath('data.title', 'Desain ERD')
            ->assertJsonPath('data.description', 'Buat ERD untuk modul absensi.')
            ->assertJsonPath('data.status', 'todo')
            ->assertJsonPath('data.due_at', '2026-10-15T17:00:00+07:00')
            ->assertJsonPath('data.is_late', false)
            ->assertJsonPath('data.intern', ['id' => $this->intern->id, 'name' => 'Andi Pratama', 'short_name' => 'Andi P.'])
            ->assertJsonPath('data.can_edit', true)
            ->assertJsonPath('data.can_delete', true);

        $task = Task::sole();
        expect($task->code)->toBe(sprintf('TSK-%03d', $task->id))
            ->and($response->json('data.code'))->toBe($task->code)
            ->and($task->mentor_id)->toBe($this->mentor->id)
            ->and($task->status)->toBe(TaskStatus::Todo);

        $notification = Notification::sole();
        expect($notification->user_id)->toBe($this->intern->id)
            ->and($notification->text)->toBe('Task baru dari Bu Sari: Desain ERD.')
            ->and($notification->link_path)->toBe('/task')
            ->and($notification->link_params)->toBe(['open' => $task->id]);
    });

    it('accepts the due time in ISO format with an offset', function () {
        mentorRequest($this->mentor, 'POST', '/api/mentor/tasks', validTask(['due_at' => '2026-10-15T10:00:00Z']))
            ->assertCreated()
            ->assertJsonPath('data.due_at', '2026-10-15T17:00:00+07:00');
    });

    it('validates the form with the prototype messages', function (array $overrides, string $field, string $message) {
        mentorRequest($this->mentor, 'POST', '/api/mentor/tasks', validTask($overrides))
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field => $message]);

        expect(Task::count())->toBe(0);
    })->with([
        'intern kosong' => [['intern_id' => null], 'intern_id', 'Pilih intern untuk Task ini.'],
        'judul kosong' => [['title' => '  '], 'title', 'Judul wajib diisi.'],
        'deskripsi kosong' => [['description' => ''], 'description', 'Deskripsi wajib diisi.'],
        'tenggat kosong' => [['due_at' => ''], 'due_at', 'Tenggat harus setelah waktu sekarang.'],
        'tenggat bukan tanggal' => [['due_at' => 'besok'], 'due_at', 'Tenggat harus setelah waktu sekarang.'],
        'tenggat sekarang' => [['due_at' => '2026-10-12 14:39'], 'due_at', 'Tenggat harus setelah waktu sekarang.'],
        'tenggat lampau' => [['due_at' => '2026-10-11 17:00'], 'due_at', 'Tenggat harus setelah waktu sekarang.'],
    ]);

    it('only allows active interns mentored by this mentor', function (Closure $intern) {
        mentorRequest($this->mentor, 'POST', '/api/mentor/tasks', validTask(['intern_id' => $intern()->id]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['intern_id' => 'Pilih intern untuk Task ini.']);

        expect(Task::count())->toBe(0)->and(Notification::count())->toBe(0);
    })->with([
        'intern mentor lain' => [fn () => User::factory()->intern()->create()],
        'intern nonaktif' => [fn () => User::factory()->intern(['mentor_id' => test()->mentor->id])->create(['is_active' => false])],
        'magang sudah selesai' => [fn () => User::factory()->intern(['mentor_id' => test()->mentor->id, 'start_date' => '2026-07-01', 'end_date' => '2026-10-11'])->create()],
        'bukan intern' => [fn () => User::factory()->admin()->create()],
    ]);

    it('saves a task due on a holiday with a warning', function () {
        Holiday::factory()->create(['date' => '2026-10-15', 'name' => 'Libur Nasional']);

        mentorRequest($this->mentor, 'POST', '/api/mentor/tasks', validTask())
            ->assertCreated()
            ->assertJsonPath('warning', 'Tenggat jatuh pada hari libur.');
    });

    it('rejects interns and admins', function (string $role) {
        mentorRequest(User::factory()->{$role}()->create(), 'POST', '/api/mentor/tasks', validTask())->assertForbidden();
    })->with(['intern', 'admin']);
});

describe('peringatan tenggat hari libur', function () {
    it('warns for weekends and admin holidays only', function (string $due, bool $holiday, ?string $name) {
        Holiday::factory()->create(['date' => '2026-10-15', 'name' => 'Libur Nasional']);

        mentorRequest($this->mentor, 'GET', '/api/mentor/tasks/due-check?due_at='.urlencode($due))
            ->assertOk()
            ->assertJsonPath('data', [
                'due_on_holiday' => $holiday,
                'holiday_name' => $name,
                'warning' => $holiday ? 'Tenggat jatuh pada hari libur.' : null,
            ]);
    })->with([
        'hari kerja' => ['2026-10-14 17:00', false, null],
        'libur admin' => ['2026-10-15 17:00', true, 'Libur Nasional'],
        'Sabtu' => ['2026-10-17 09:00', true, null],
    ]);

    it('requires a date', function () {
        mentorRequest($this->mentor, 'GET', '/api/mentor/tasks/due-check')->assertUnprocessable();
    });
});

describe('Ubah Task', function () {
    it('updates title, description, and due date and notifies the intern', function () {
        $task = mentorTask($this->mentor, $this->intern, ['title' => 'Desain ERD', 'status' => TaskStatus::InProgress]);

        mentorRequest($this->mentor, 'PUT', "/api/mentor/tasks/{$task->id}", [
            'title' => 'Desain ERD v2',
            'description' => 'Tambahkan tabel izin.',
            'due_at' => '2026-10-16 12:00',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Perubahan tersimpan.')
            ->assertJsonPath('data.title', 'Desain ERD v2')
            ->assertJsonPath('data.status', 'in_progress')
            ->assertJsonPath('data.due_at', '2026-10-16T12:00:00+07:00')
            ->assertJsonPath('data.can_delete', false);

        $notification = Notification::sole();
        expect($notification->user_id)->toBe($this->intern->id)
            ->and($notification->text)->toBe("Task 'Desain ERD v2' diubah mentor.")
            ->and($notification->link_params)->toBe(['open' => $task->id]);
    });

    it('ignores a changed intern', function () {
        $task = mentorTask($this->mentor, $this->intern);
        $other = User::factory()->intern(['mentor_id' => $this->mentor->id])->create();

        mentorRequest($this->mentor, 'PUT', "/api/mentor/tasks/{$task->id}", [
            ...validTask(['intern_id' => $other->id]),
        ])->assertOk();

        expect($task->fresh()->intern_id)->toBe($this->intern->id);
    });

    it('keeps a past due date when it is not changed, but rejects moving it into the past', function () {
        $task = mentorTask($this->mentor, $this->intern, ['due_at' => '2026-10-10 17:00:00']);

        mentorRequest($this->mentor, 'PUT', "/api/mentor/tasks/{$task->id}", [
            'title' => 'Judul baru', 'description' => 'Deskripsi', 'due_at' => '2026-10-10 17:00',
        ])->assertOk()->assertJsonPath('data.is_late', true);

        mentorRequest($this->mentor, 'PUT', "/api/mentor/tasks/{$task->id}", [
            'title' => 'Judul baru', 'description' => 'Deskripsi', 'due_at' => '2026-10-11 17:00',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['due_at' => 'Tenggat harus setelah waktu sekarang.']);
    });

    it('does not notify when nothing changed', function () {
        $task = mentorTask($this->mentor, $this->intern, ['title' => 'Sama', 'description' => 'Sama', 'due_at' => '2026-10-15 17:00:00']);

        mentorRequest($this->mentor, 'PUT', "/api/mentor/tasks/{$task->id}", [
            'title' => 'Sama', 'description' => 'Sama', 'due_at' => '2026-10-15 17:00',
        ])->assertOk();

        expect(Notification::count())->toBe(0);
    });

    it('locks a done task', function () {
        $task = mentorTask($this->mentor, $this->intern, ['status' => TaskStatus::Done, 'title' => 'Lama']);

        mentorRequest($this->mentor, 'PUT', "/api/mentor/tasks/{$task->id}", validTask())
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Task sudah selesai dan terkunci.')
            ->assertJsonPath('reason', 'done_locked');

        expect($task->fresh()->title)->toBe('Lama');
    });

    it('rejects a task held by another mentor', function () {
        $task = Task::factory()->create();

        mentorRequest($this->mentor, 'PUT', "/api/mentor/tasks/{$task->id}", validTask())
            ->assertForbidden()
            ->assertJsonPath('message', 'Anda tidak memiliki akses ke Task ini.');
    });
});

describe('Hapus Task', function () {
    it('deletes a To Do task without comments and notifies the intern', function () {
        $task = mentorTask($this->mentor, $this->intern, ['title' => 'Uji login']);
        TaskRead::query()->create(['task_id' => $task->id, 'user_id' => $this->intern->id, 'last_read_at' => now()]);

        mentorRequest($this->mentor, 'DELETE', "/api/mentor/tasks/{$task->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Task dihapus. Intern sudah diberi tahu.');

        expect(Task::count())->toBe(0)->and(TaskRead::count())->toBe(0);

        $notification = Notification::sole();
        expect($notification->user_id)->toBe($this->intern->id)
            ->and($notification->text)->toBe("Task 'Uji login' dibatalkan mentor.")
            ->and($notification->link_path)->toBe('/task')
            ->and($notification->link_params)->toBeNull();
    });

    it('does not delete a task that has been started', function (TaskStatus $status) {
        $task = mentorTask($this->mentor, $this->intern, ['status' => $status]);

        mentorRequest($this->mentor, 'DELETE', "/api/mentor/tasks/{$task->id}")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Task yang sudah dikerjakan tidak dapat dihapus.')
            ->assertJsonPath('reason', 'not_todo');

        expect(Task::count())->toBe(1);
    })->with([TaskStatus::InProgress, TaskStatus::InReview, TaskStatus::Done]);

    it('does not delete a task with comments', function () {
        $task = mentorTask($this->mentor, $this->intern);
        TaskComment::factory()->for($task)->create(['user_id' => $this->mentor->id]);

        mentorRequest($this->mentor, 'DELETE', "/api/mentor/tasks/{$task->id}")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Task yang sudah memiliki komentar tidak dapat dihapus.')
            ->assertJsonPath('reason', 'has_comments');

        expect(Task::count())->toBe(1)->and(Notification::count())->toBe(0);
    });

    it('rejects a task held by another mentor', function () {
        $task = Task::factory()->create();

        mentorRequest($this->mentor, 'DELETE', "/api/mentor/tasks/{$task->id}")->assertForbidden();

        expect(Task::count())->toBe(1);
    });
});
