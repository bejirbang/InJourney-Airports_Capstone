<?php

use App\Enums\TaskStatus;
use App\Models\Notification;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake();
    $this->travelTo(Carbon::parse('2026-10-12 14:39:00'));

    $this->mentor = User::factory()->mentor()->create(['name' => 'Sari Wijaya']);
    $this->intern = User::factory()->intern([
        'mentor_id' => $this->mentor->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
    ])->create(['name' => 'Rina Wulandari']);
    $this->token = $this->intern->createToken('api')->plainTextToken;
    $this->task = Task::factory()->for($this->intern, 'intern')->for($this->mentor, 'mentor')->create([
        'code' => 'TSK-024',
        'title' => 'Laporan API',
        'status' => TaskStatus::InProgress,
        'due_at' => '2026-10-14 17:00:00',
    ]);
});

function submitTask(array $data, ?Task $task = null)
{
    $task ??= test()->task;

    return test()->post("/api/intern/tasks/{$task->id}/submission", $data, [
        'Authorization' => 'Bearer '.test()->token,
        'Accept' => 'application/json',
    ]);
}

function pdf(string $name = 'hasil.pdf', int $kb = 300): UploadedFile
{
    return UploadedFile::fake()->create($name, $kb, 'application/pdf');
}

it('submits a link and moves the task to in review', function () {
    submitTask(['link' => 'https://drive.example.com/laporan'])
        ->assertOk()
        ->assertJsonPath('message', 'Hasil terkumpul. Menunggu pemeriksaan mentor.')
        ->assertJsonPath('data.status', 'in_review')
        ->assertJsonPath('data.action', 'replace')
        ->assertJsonPath('data.ever_submitted', true);

    $task = $this->task->refresh();
    expect($task->submission_link)->toBe('https://drive.example.com/laporan')
        ->and($task->submission_file_path)->toBeNull()
        ->and($task->submitted_at->toDateTimeString())->toBe('2026-10-12 14:39:00');
});

it('submits a file, a link, or both', function (array $data, bool $hasLink, bool $hasFile) {
    submitTask($data)->assertOk();

    $task = $this->task->refresh();
    expect($task->submission_link !== null)->toBe($hasLink)
        ->and($task->submission_file_path !== null)->toBe($hasFile);

    if ($hasFile) {
        Storage::assertExists($task->submission_file_path);
        expect($task->submission_file_path)->toStartWith("tasks/{$task->id}/");
    }
})->with([
    'file saja' => [fn () => ['file' => pdf()], false, true],
    'link dan file' => [fn () => ['link' => 'http://example.com/a', 'file' => pdf()], true, true],
]);

it('notifies the mentor about a new submission', function () {
    submitTask(['link' => 'https://example.com/laporan'])->assertOk();

    $notification = Notification::sole();
    expect($notification->user_id)->toBe($this->mentor->id)
        ->and($notification->text)->toBe("Rina W. mengumpulkan Task 'Laporan API'.")
        ->and($notification->link_path)->toBe('/task')
        ->and($notification->link_params)->toBe(['open' => $this->task->id]);
});

it('replaces the whole previous result while in review and deletes the old file', function () {
    submitTask(['link' => 'https://example.com/v1', 'file' => pdf('v1.pdf')])->assertOk();
    $oldPath = $this->task->refresh()->submission_file_path;

    $this->travelTo(Carbon::parse('2026-10-12 16:00:00'));

    submitTask(['link' => 'https://example.com/v2', 'from' => 'in_review'])
        ->assertOk()
        ->assertJsonPath('data.status', 'in_review');

    $task = $this->task->refresh();
    Storage::assertMissing($oldPath);
    expect($task->submission_link)->toBe('https://example.com/v2')
        ->and($task->submission_file_path)->toBeNull()
        ->and($task->submitted_at->toDateTimeString())->toBe('2026-10-12 16:00:00');

    expect(Notification::query()->latest('id')->first()->text)->toBe("Rina W. mengganti hasil Task 'Laporan API'.");
});

it('resubmits after revise, clearing the revise banner', function () {
    $this->task->update(['ever_submitted' => true, 'revise_pending' => true, 'submission_link' => 'https://example.com/v1']);

    submitTask(['file' => pdf()])
        ->assertOk()
        ->assertJsonPath('data.status', 'in_review')
        ->assertJsonPath('data.revise_pending', false);

    expect($this->task->refresh()->submission_link)->toBeNull()
        ->and(Notification::sole()->text)->toBe("Rina W. mengumpulkan Task 'Laporan API'.");
});

it('accepts a late submission', function () {
    $this->task->update(['due_at' => '2026-10-10 17:00:00']);

    submitTask(['link' => 'https://example.com/laporan'])
        ->assertOk()
        ->assertJsonPath('data.is_late', true);
});

it('validates link and file with the documented messages', function (array $data, string $field, string $message) {
    submitTask($data)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);

    expect($this->task->refresh()->status)->toBe(TaskStatus::InProgress);
})->with([
    'kosong' => [fn () => [], 'link', 'Isi link atau pilih file.'],
    'link spasi' => [fn () => ['link' => '   '], 'link', 'Isi link atau pilih file.'],
    'tanpa http' => [fn () => ['link' => 'drive.example.com/laporan'], 'link', 'Format link tidak valid.'],
    'lebih dari 2 MB' => [fn () => ['file' => pdf('besar.pdf', 2049)], 'file', 'Ukuran file maksimal 2 MB.'],
    'zip' => [fn () => ['file' => UploadedFile::fake()->create('kode.zip', 100, 'application/zip')], 'file', 'Jenis file tidak diizinkan. Gunakan PDF, Word, Excel, atau PowerPoint, atau kirim lewat link.'],
]);

it('rejects submitting a task that was not started', function () {
    $this->task->update(['status' => TaskStatus::Todo]);

    submitTask(['link' => 'https://example.com/laporan'])
        ->assertUnprocessable()
        ->assertExactJson(['message' => 'Mulai kerjakan Task dulu sebelum mengumpulkan.', 'reason' => 'not_started']);
});

it('rejects submitting a done task, saying whether the mentor just accepted it', function (?string $from, string $message, string $reason) {
    $this->task->update(['status' => TaskStatus::Done, 'submission_link' => 'https://example.com/diterima']);

    submitTask(array_filter(['link' => 'https://example.com/baru', 'file' => pdf(), 'from' => $from]))
        ->assertUnprocessable()
        ->assertExactJson(['message' => $message, 'reason' => $reason]);

    expect($this->task->refresh()->submission_link)->toBe('https://example.com/diterima')
        ->and(Storage::allFiles())->toBe([])
        ->and(Notification::count())->toBe(0);
})->with([
    'dialog dibuka saat Done' => [null, 'Task ini sudah selesai.', 'done'],
    'Accept saat mengganti hasil' => ['in_review', 'Task sudah diterima mentor.', 'accepted'],
]);

it('lets the intern download their submitted file', function () {
    submitTask(['file' => pdf('laporan.pdf')])->assertOk();

    $this->getJson("/api/intern/tasks/{$this->task->id}/submission/file", ['Authorization' => 'Bearer '.$this->token])
        ->assertOk()
        ->assertDownload('hasil-TSK-024.pdf');
});

it('returns not found when the task has no file', function () {
    $this->getJson("/api/intern/tasks/{$this->task->id}/submission/file", ['Authorization' => 'Bearer '.$this->token])
        ->assertNotFound();
});

it('hides other interns’ tasks', function () {
    $other = Task::factory()->create(['status' => TaskStatus::InProgress]);

    submitTask(['link' => 'https://example.com/x'], $other)->assertForbidden();
    $this->getJson("/api/intern/tasks/{$other->id}/submission/file", ['Authorization' => 'Bearer '.$this->token])
        ->assertForbidden();

    expect($other->refresh()->status)->toBe(TaskStatus::InProgress);
});

it('rejects mentors and admins', function (string $role) {
    $user = User::factory()->{$role}()->create();

    $this->postJson("/api/intern/tasks/{$this->task->id}/submission", ['link' => 'https://example.com/x'], [
        'Authorization' => 'Bearer '.$user->createToken('api')->plainTextToken,
    ])->assertForbidden();
})->with(['mentor', 'admin']);
