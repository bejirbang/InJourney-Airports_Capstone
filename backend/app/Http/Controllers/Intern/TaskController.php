<?php

namespace App\Http\Controllers\Intern;

use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Intern\TaskIndexRequest;
use App\Http\Requests\Intern\TaskMoveRequest;
use App\Http\Requests\Intern\TaskSubmissionRequest;
use App\Http\Requests\Shared\TaskCommentRequest;
use App\Http\Resources\InternTaskResource;
use App\Http\Resources\TaskCommentResource;
use App\Models\Task;
use App\Models\User;
use App\Services\InternTasks;
use App\Services\TaskComments;
use App\Services\TaskSubmissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TaskController extends Controller
{
    public function index(TaskIndexRequest $request, InternTasks $tasks): JsonResponse
    {
        /** @var User $intern */
        $intern = $request->user();

        $result = $tasks->list($intern, [
            'status' => $request->input('status'),
            'late' => $request->boolean('late'),
            'q' => $request->input('q'),
            'sort' => $request->input('sort'),
            'include_older_done' => $request->boolean('include_older_done'),
        ], Date::now());

        return response()->json([
            'data' => InternTaskResource::collection($result['tasks']),
            'meta' => ['hidden_done' => $result['hidden_done']],
        ]);
    }

    public function show(Request $request, Task $task, InternTasks $tasks): InternTaskResource
    {
        Gate::authorize('view', $task);

        /** @var User $intern */
        $intern = $request->user();

        ['task' => $opened, 'unread_ids' => $unread] = $tasks->open($intern, $task, Date::now());

        $resource = new InternTaskResource($opened);
        $resource->unreadIds = $unread;

        return $resource;
    }

    public function move(TaskMoveRequest $request, Task $task, InternTasks $tasks): JsonResponse
    {
        Gate::authorize('move', $task);

        $from = $request->filled('from') ? TaskStatus::from($request->string('from')->value()) : null;
        $moved = $tasks->move($task, TaskStatus::from($request->string('to')->value()), $from);

        return response()->json(['data' => new InternTaskResource($moved->load('mentor:id,name'))]);
    }

    public function submit(TaskSubmissionRequest $request, Task $task, TaskSubmissions $submissions): JsonResponse
    {
        Gate::authorize('submit', $task);

        /** @var User $intern */
        $intern = $request->user();

        $submitted = $submissions->submit(
            $intern,
            $task,
            $request->filled('link') ? $request->string('link')->trim()->value() : null,
            $request->file('file'),
            $request->filled('from') ? TaskStatus::from($request->string('from')->value()) : null,
            Date::now(),
        );

        return response()->json([
            'message' => 'Hasil terkumpul. Menunggu pemeriksaan mentor.',
            'data' => new InternTaskResource($submitted->load('mentor:id,name')),
        ]);
    }

    public function comment(TaskCommentRequest $request, Task $task, TaskComments $comments): JsonResponse
    {
        Gate::authorize('comment', $task);

        /** @var User $intern */
        $intern = $request->user();

        $comment = $comments->reply($intern, $task, $request->string('body')->value(), Date::now());

        return (new TaskCommentResource($comment))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function submissionFile(Task $task): StreamedResponse
    {
        Gate::authorize('view', $task);

        $path = $task->submission_file_path;
        abort_if($path === null || ! Storage::exists($path), 404, 'File hasil tidak ditemukan.');

        return Storage::download($path, $task->submissionFileName());
    }
}
