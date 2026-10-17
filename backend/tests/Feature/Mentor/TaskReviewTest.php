<?php

use App\Enums\TaskStatus;
use App\Models\MentorHistory;
use App\Models\Notification;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskRead;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

// "Hari ini" sama dengan prototipe frontend: Senin, 12 Oktober 2026 pukul 14:39.
beforeEach(function () {
    Storage::fake();
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->mentor = User::factory()->mentor()->create(['name' => 'Bu Sari']);
    $this->intern = User::factory()->intern([
        'mentor_id' => $this->mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create(['name' => 'Rina Wulandari']);

    $this->task = Task::factory()->create([
        'mentor_id' => $this->mentor->id,
        'intern_id' => $this->intern->id,
        'title' => 'Laporan API',
        'description' => 'Susun laporan pengujian endpoint API login dan absensi.',
        'status' => TaskStatus::InReview,
        'due_at' => '2026-10-11 17:00:00',
        'submitted_at' => '2026-10-12 08:30:00',
        'submission_link' => 'https://drive.example.com/laporan-api',
        'ever_submitted' => true,
    ]);
});

function reviewCall(User $mentor, string $method, string $uri, array $data = []): TestResponse
{
    // Beberapa pengguna dalam satu test: lupakan pengguna dari request sebelumnya.
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $data, ['Authorization' => 'Bearer '.$mentor->createToken('api')->plainTextToken]);
}

describe('detail Task', function () {
    it('shows the submission, late marks, and the comment thread', function () {
        Storage::put('tasks/1/laporan.pdf', str_repeat('x', 1200));
        $this->task->update(['submission_file_path' => 'tasks/1/laporan.pdf']);
        $first = TaskComment::factory()->for($this->task)->create(['user_id' => $this->mentor->id, 'body' => 'Tolong sertakan contoh respons error.', 'created_at' => '2026-10-10 09:00:00']);
        $reply = TaskComment::factory()->for($this->task)->create(['user_id' => $this->intern->id, 'body' => 'Sudah ditambahkan di bagian 3, Bu.', 'created_at' => '2026-10-12 08:31:00']);

        reviewCall($this->mentor, 'GET', "/api/mentor/tasks/{$this->task->id}")
            ->assertOk()
            ->assertJsonPath('data.title', 'Laporan API')
            ->assertJsonPath('data.description', 'Susun laporan pengujian endpoint API login dan absensi.')
            ->assertJsonPath('data.status', 'in_review')
            ->assertJsonPath('data.is_late', true)
            ->assertJsonPath('data.intern.name', 'Rina Wulandari')
            ->assertJsonPath('data.intern_is_active', true)
            ->assertJsonPath('data.submission', [
                'link' => 'https://drive.example.com/laporan-api',
                'file' => ['name' => "hasil-{$this->task->code}.pdf", 'size' => 1200],
                'submitted_at' => '2026-10-12T08:30:00+07:00',
                'submitted_late' => true,
                'late_hours' => 16,
            ])
            ->assertJsonPath('data.can_review', true)
            ->assertJsonPath('data.can_comment', true)
            ->assertJsonPath('data.revise_warning', null)
            ->assertJsonPath('data.comments.0.id', $first->id)
            ->assertJsonPath('data.comments.0.author.role', 'mentor')
            ->assertJsonPath('data.comments.0.is_unread', false)
            ->assertJsonPath('data.comments.1.id', $reply->id)
            ->assertJsonPath('data.comments.1.is_unread', true);

        // Membuka detail menandai komentar terbaca.
        reviewCall($this->mentor, 'GET', "/api/mentor/tasks/{$this->task->id}")->assertJsonPath('data.comments.1.is_unread', false);

        expect(TaskRead::query()->where('user_id', $this->mentor->id)->value('last_read_at')->toDateTimeString())->toBe('2026-10-12 14:39:00');
    });

    it('shows no submission for a task that was never submitted', function () {
        $todo = Task::factory()->create(['mentor_id' => $this->mentor->id, 'intern_id' => $this->intern->id]);

        reviewCall($this->mentor, 'GET', "/api/mentor/tasks/{$todo->id}")
            ->assertOk()
            ->assertJsonPath('data.submission', null)
            ->assertJsonPath('data.can_review', false)
            ->assertJsonPath('data.comments', []);
    });

    it('is read-only once done', function () {
        $this->task->update(['status' => TaskStatus::Done, 'done_at' => now()]);

        reviewCall($this->mentor, 'GET', "/api/mentor/tasks/{$this->task->id}")
            ->assertOk()
            ->assertJsonPath('data.can_review', false)
            ->assertJsonPath('data.can_comment', false)
            ->assertJsonPath('data.can_edit', false);
    });

    it('warns when the intern is inactive', function () {
        $this->intern->update(['is_active' => false]);

        reviewCall($this->mentor, 'GET', "/api/mentor/tasks/{$this->task->id}")
            ->assertOk()
            ->assertJsonPath('data.intern_is_active', false)
            ->assertJsonPath('data.revise_warning', 'Intern sudah nonaktif dan tidak dapat menindaklanjuti revisi.');
    });

    it('tells a former mentor the intern has moved, and rejects other mentors', function () {
        $newMentor = User::factory()->mentor()->create();
        $this->task->update(['mentor_id' => $newMentor->id]);
        MentorHistory::query()->create(['intern_id' => $this->intern->id, 'mentor_id' => $this->mentor->id, 'started_at' => '2026-09-01', 'ended_at' => '2026-10-12']);

        reviewCall($this->mentor, 'POST', "/api/mentor/tasks/{$this->task->id}/accept")
            ->assertForbidden()
            ->assertJsonPath('message', 'Intern ini sudah dipindahkan ke mentor lain.');

        reviewCall(User::factory()->mentor()->create(), 'GET', "/api/mentor/tasks/{$this->task->id}")
            ->assertForbidden()
            ->assertJsonPath('message', 'Anda tidak memiliki akses ke Task ini.');
    });
});

describe('file hasil', function () {
    beforeEach(function () {
        Storage::put('tasks/1/laporan.pdf', '%PDF-1.4 isi');
        $this->task->update(['submission_file_path' => 'tasks/1/laporan.pdf']);
    });

    it('downloads the file, or shows it inline for preview', function () {
        reviewCall($this->mentor, 'GET', "/api/mentor/tasks/{$this->task->id}/submission/file")
            ->assertOk()
            ->assertDownload("hasil-{$this->task->code}.pdf");

        $inline = reviewCall($this->mentor, 'GET', "/api/mentor/tasks/{$this->task->id}/submission/file?inline=1")->assertOk();
        expect($inline->headers->get('Content-Disposition'))->toStartWith('inline');
    });

    it('returns 404 without a file and 403 for other mentors', function () {
        reviewCall(User::factory()->mentor()->create(), 'GET', "/api/mentor/tasks/{$this->task->id}/submission/file")->assertForbidden();

        $this->task->update(['submission_file_path' => null]);
        reviewCall($this->mentor, 'GET', "/api/mentor/tasks/{$this->task->id}/submission/file")->assertNotFound();
    });
});

describe('komentar mentor', function () {
    it('adds a comment and notifies the intern', function () {
        reviewCall($this->mentor, 'POST', "/api/mentor/tasks/{$this->task->id}/comments", ['body' => 'Tambahkan contoh error 401.'])
            ->assertCreated()
            ->assertJsonPath('data.body', 'Tambahkan contoh error 401.')
            ->assertJsonPath('data.author.name', 'Bu Sari')
            ->assertJsonPath('data.is_revision', false);

        $notification = Notification::sole();
        expect($notification->user_id)->toBe($this->intern->id)
            ->and($notification->text)->toBe("Bu Sari berkomentar di 'Laporan API'.")
            ->and($notification->link_params)->toBe(['open' => $this->task->id, 'to' => 'comments']);
    });

    it('rejects an empty comment and a done task', function () {
        reviewCall($this->mentor, 'POST', "/api/mentor/tasks/{$this->task->id}/comments", ['body' => '   '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['body' => 'Tulis komentar dulu.']);

        $this->task->update(['status' => TaskStatus::Done]);

        reviewCall($this->mentor, 'POST', "/api/mentor/tasks/{$this->task->id}/comments", ['body' => 'Satu lagi'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Task sudah selesai dan terkunci.')
            ->assertJsonPath('reason', 'done_locked');
    });
});

describe('Accept', function () {
    it('marks the task done and notifies the intern', function () {
        $this->task->update(['revise_pending' => true]);

        reviewCall($this->mentor, 'POST', "/api/mentor/tasks/{$this->task->id}/accept", ['submitted_at' => '2026-10-12T08:30:00+07:00'])
            ->assertOk()
            ->assertJsonPath('message', 'Task diterima dan ditandai Done.')
            ->assertJsonPath('data.status', 'done')
            ->assertJsonPath('data.done_at', '2026-10-12T14:39:00+07:00');

        expect($this->task->fresh())->status->toBe(TaskStatus::Done)->revise_pending->toBeFalse()
            ->and(TaskComment::count())->toBe(0);

        $notification = Notification::sole();
        expect($notification->text)->toBe("Task 'Laporan API' diterima.")
            ->and($notification->link_params)->toBe(['open' => $this->task->id]);
    });

    it('stores the optional comment in the thread', function () {
        reviewCall($this->mentor, 'POST', "/api/mentor/tasks/{$this->task->id}/accept", ['comment' => 'Bagus, terima kasih.'])->assertOk();

        expect(TaskComment::sole())->body->toBe('Bagus, terima kasih.')->is_revision->toBeFalse();
    });

    it('still accepts when the intern is inactive', function () {
        $this->intern->update(['is_active' => false]);

        reviewCall($this->mentor, 'POST', "/api/mentor/tasks/{$this->task->id}/accept")->assertOk();
    });
});

describe('Revise', function () {
    it('returns the task to In Progress with a revision comment and notifies the intern', function () {
        reviewCall($this->mentor, 'POST', "/api/mentor/tasks/{$this->task->id}/revise", [
            'comment' => 'Tambahkan contoh respons error.',
            'submitted_at' => '2026-10-12T08:30:00+07:00',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Revisi terkirim. Task kembali ke In Progress.')
            ->assertJsonPath('data.status', 'in_progress')
            ->assertJsonPath('data.revision_count', 1)
            ->assertJsonPath('warning', null);

        $task = $this->task->fresh();
        expect($task->status)->toBe(TaskStatus::InProgress)
            ->and($task->revise_pending)->toBeTrue()
            ->and($task->revision_count)->toBe(1)
            ->and(TaskComment::sole())->body->toBe('Tambahkan contoh respons error.')->is_revision->toBeTrue();

        $notification = Notification::sole();
        expect($notification->user_id)->toBe($this->intern->id)
            ->and($notification->text)->toBe("Task 'Laporan API' perlu direvisi.")
            ->and($notification->link_params)->toBe(['open' => $this->task->id, 'to' => 'comments']);
    });

    it('requires a revision comment', function () {
        reviewCall($this->mentor, 'POST', "/api/mentor/tasks/{$this->task->id}/revise", ['comment' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comment' => 'Komentar revisi wajib diisi.']);

        expect($this->task->fresh()->status)->toBe(TaskStatus::InReview);
    });

    it('still revises an inactive intern but returns the warning', function () {
        $this->intern->update(['is_active' => false]);

        reviewCall($this->mentor, 'POST', "/api/mentor/tasks/{$this->task->id}/revise", ['comment' => 'Catatan akhir.'])
            ->assertOk()
            ->assertJsonPath('warning', 'Intern sudah nonaktif dan tidak dapat menindaklanjuti revisi.');
    });
});

describe('perubahan bersamaan', function () {
    it('rejects a decision when the intern has replaced the result', function (string $action) {
        reviewCall($this->mentor, 'POST', "/api/mentor/tasks/{$this->task->id}/{$action}", [
            'comment' => 'Revisi',
            'submitted_at' => '2026-10-12T08:00:00+07:00',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Hasil baru dikumpulkan. Muat ulang.')
            ->assertJsonPath('reason', 'resubmitted');

        expect($this->task->fresh()->status)->toBe(TaskStatus::InReview)->and(Notification::count())->toBe(0);
    })->with(['accept', 'revise']);

    it('rejects a decision on a task that is no longer In Review', function (TaskStatus $status, string $action) {
        $this->task->update(['status' => $status]);

        reviewCall($this->mentor, 'POST', "/api/mentor/tasks/{$this->task->id}/{$action}", ['comment' => 'Revisi'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Status Task sudah berubah. Muat ulang.')
            ->assertJsonPath('reason', 'stale');
    })->with([
        [TaskStatus::Todo, 'accept'],
        [TaskStatus::InProgress, 'revise'],
        [TaskStatus::Done, 'accept'],
        [TaskStatus::Done, 'revise'],
    ]);

    it('lets the intern resubmit after a revise and the mentor accept the new result', function () {
        reviewCall($this->mentor, 'POST', "/api/mentor/tasks/{$this->task->id}/revise", ['comment' => 'Perbaiki bagian 2.'])->assertOk();

        $this->travelTo(Carbon::parse('2026-10-12 16:00:00'));
        app('auth')->forgetGuards();
        $this->postJson("/api/intern/tasks/{$this->task->id}/submission", [
            'file' => UploadedFile::fake()->create('laporan-v2.pdf', 100, 'application/pdf'),
        ], ['Authorization' => 'Bearer '.$this->intern->createToken('api')->plainTextToken])->assertOk();

        reviewCall($this->mentor, 'POST', "/api/mentor/tasks/{$this->task->id}/accept", ['submitted_at' => '2026-10-12T16:00:00+07:00'])
            ->assertOk()
            ->assertJsonPath('data.status', 'done');
    });
});
