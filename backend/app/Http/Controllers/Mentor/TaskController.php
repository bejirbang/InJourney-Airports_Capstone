<?php

namespace App\Http\Controllers\Mentor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Mentor\TaskDueCheckRequest;
use App\Http\Requests\Mentor\TaskFormRequest;
use App\Http\Requests\Mentor\TaskIndexRequest;
use App\Http\Requests\Mentor\TaskReviewRequest;
use App\Http\Requests\Shared\TaskCommentRequest;
use App\Http\Resources\MentorTaskDetailResource;
use App\Http\Resources\MentorTaskResource;
use App\Http\Resources\TaskCommentResource;
use App\Models\Task;
use App\Models\User;
use App\Services\MentorTaskReview;
use App\Services\MentorTasks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Halaman Task mentor (docs/design-mentor.md, Alur 5), buat, ubah, dan hapus Task (Alur 4),
 * serta detail, komentar, Accept, dan Revise (Alur 6).
 * Akses per Task lewat TaskPolicy::manage (hanya Task yang dipegang mentor itu).
 */
class TaskController extends Controller
{
    public function __construct(private MentorTasks $tasks) {}

    /**
     * Kanban dan Daftar Task (Alur 5). Kolom Done hanya 30 hari terakhir kecuali `include_older_done`.
     */
    public function index(TaskIndexRequest $request): JsonResponse
    {
        /** @var User $mentor */
        $mentor = $request->user();

        $result = $this->tasks->list($mentor, [
            'intern_id' => $request->input('intern_id'),
            'status' => $request->input('status'),
            'late' => $request->boolean('late'),
            'due_from' => $request->input('due_from'),
            'due_to' => $request->input('due_to'),
            'q' => $request->input('q'),
            'sort' => $request->input('sort'),
            'include_older_done' => $request->boolean('include_older_done'),
        ], Date::now());

        return response()->json([
            'data' => MentorTaskResource::collection($result['tasks']),
            // Jumlah Task Done lebih dari 30 hari yang disembunyikan; tampilkan dengan include_older_done=1.
            'meta' => ['hidden_done' => $result['hidden_done']],
        ]);
    }

    public function store(TaskFormRequest $request): JsonResponse
    {
        /** @var User $mentor */
        $mentor = $request->user();

        /** @var array{intern_id: int|string, title: string, description: string, due_at: string} $input */
        $input = $request->validated();
        $task = $this->tasks->create($mentor, $input, Date::now());

        return response()->json([
            'message' => 'Task dibuat. Intern sudah diberi tahu.',
            'data' => new MentorTaskResource($task->load('intern')),
            'warning' => $this->tasks->dueCheck($task->due_at)['warning'],
        ], Response::HTTP_CREATED);
    }

    public function update(TaskFormRequest $request, Task $task): JsonResponse
    {
        Gate::authorize('manage', $task);

        /** @var array{title: string, description: string, due_at: string} $input */
        $input = $request->validated();
        $task = $this->tasks->update($task, $input, Date::now());

        return response()->json([
            'message' => 'Perubahan tersimpan.',
            'data' => new MentorTaskResource($task->load('intern')),
            'warning' => $this->tasks->dueCheck($task->due_at)['warning'],
        ]);
    }

    public function destroy(Task $task): JsonResponse
    {
        Gate::authorize('manage', $task);

        $this->tasks->delete($task);

        return response()->json(['message' => 'Task dihapus. Intern sudah diberi tahu.']);
    }

    /**
     * Peringatan "Tenggat jatuh pada hari libur." sebelum Simpan. Task tetap bisa disimpan.
     */
    public function dueCheck(TaskDueCheckRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->tasks->dueCheck(MentorTasks::parseDue($request->string('due_at')->value())),
        ]);
    }

    /**
     * Detail Task (Alur 6): hasil kumpulan dan thread komentar. Komentar baru ditandai terbaca.
     */
    public function show(Request $request, Task $task, MentorTaskReview $review): MentorTaskDetailResource
    {
        Gate::authorize('manage', $task);

        /** @var User $mentor */
        $mentor = $request->user();

        $opened = $review->open($mentor, $task, Date::now());

        $resource = new MentorTaskDetailResource($opened['task']);
        $resource->unreadIds = $opened['unread_ids'];
        $resource->inactiveWarning = $review->inactiveWarning($opened['task'], Date::now());

        return $resource;
    }

    /**
     * File hasil kumpulan. `?inline=1` untuk Pratinjau di tab browser, tanpanya Unduh.
     * File tidak pernah diberi URL publik.
     */
    public function submissionFile(Request $request, Task $task): StreamedResponse
    {
        Gate::authorize('manage', $task);

        $path = $task->submission_file_path;
        abort_if($path === null || ! Storage::exists($path), 404, 'File hasil tidak ditemukan.');

        return $request->boolean('inline')
            ? Storage::response($path, $task->submissionFileName())
            : Storage::download($path, $task->submissionFileName());
    }

    public function comment(TaskCommentRequest $request, Task $task, MentorTaskReview $review): JsonResponse
    {
        Gate::authorize('manage', $task);

        /** @var User $mentor */
        $mentor = $request->user();

        $comment = $review->comment($mentor, $task, $request->string('body')->value(), Date::now());

        return (new TaskCommentResource($comment))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * Accept (juga dari seret kartu In Review ke Done). Body: `comment` opsional, `submitted_at` yang dilihat mentor.
     */
    public function accept(TaskReviewRequest $request, Task $task, MentorTaskReview $review): JsonResponse
    {
        Gate::authorize('manage', $task);

        /** @var User $mentor */
        $mentor = $request->user();

        $accepted = $review->accept(
            $mentor,
            $task,
            $request->filled('comment') ? $request->string('comment')->value() : null,
            $request->filled('submitted_at') ? $request->string('submitted_at')->value() : null,
            Date::now(),
        );

        return response()->json([
            'message' => 'Task diterima dan ditandai Done.',
            'data' => new MentorTaskResource($accepted->load('intern')->loadCount('comments')),
        ]);
    }

    /**
     * Revise (juga dari seret kartu In Review ke In Progress). Body: `comment` wajib, `submitted_at` yang dilihat mentor.
     */
    public function revise(TaskReviewRequest $request, Task $task, MentorTaskReview $review): JsonResponse
    {
        Gate::authorize('manage', $task);

        /** @var User $mentor */
        $mentor = $request->user();

        $result = $review->revise(
            $mentor,
            $task,
            $request->string('comment')->value(),
            $request->filled('submitted_at') ? $request->string('submitted_at')->value() : null,
            Date::now(),
        );

        return response()->json([
            'message' => 'Revisi terkirim. Task kembali ke In Progress.',
            'data' => new MentorTaskResource($result['task']->loadCount('comments')),
            'warning' => $result['warning'],
        ]);
    }
}
