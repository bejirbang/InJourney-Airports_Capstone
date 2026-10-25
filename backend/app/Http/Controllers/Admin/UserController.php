<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ChangeMentorRequest;
use App\Http\Requests\Admin\ExtendInternshipRequest;
use App\Http\Requests\Admin\UserFormRequest;
use App\Http\Requests\Admin\UserIndexRequest;
use App\Http\Resources\AdminUserResource;
use App\Models\User;
use App\Services\AccountManagement;
use App\Services\AdminUsers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Date;

class UserController extends Controller
{
    public function __construct(private AdminUsers $users, private AccountManagement $accounts) {}

    public function index(UserIndexRequest $request): JsonResponse
    {
        $page = $this->users->list([
            'q' => $request->input('q'),
            'role' => $request->input('role'),
            'status' => $request->input('status'),
        ], Date::now());

        return response()->json([
            'data' => AdminUserResource::collection($page->items()),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function mentors(): JsonResponse
    {
        return response()->json([
            'data' => $this->users->activeMentors()->map(fn (User $mentor): array => [
                'id' => $mentor->id,
                'name' => $mentor->name,
                'unit' => $mentor->unit === null ? null : ['id' => $mentor->unit->id, 'name' => $mentor->unit->name],
            ])->values(),
        ]);
    }

    public function store(UserFormRequest $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        /** @var array{name: string, email: string, role: string, unit_id?: int|string, mentor_id?: int|string, airport_id?: int|string, university?: string, major?: string, start_date?: string, end_date?: string} $input */
        $input = $request->validated();
        $result = $this->accounts->create($admin, $input);

        return response()->json([
            'data' => $this->detailed($result['user']),
            'temporary_password' => $result['temporary_password'],
        ], Response::HTTP_CREATED);
    }

    public function show(User $user): AdminUserResource
    {
        return $this->detailed($user);
    }

    public function update(UserFormRequest $request, User $user): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        /** @var array{name: string, email: string, unit_id?: int|string, airport_id?: int|string, university?: string, major?: string, start_date?: string, end_date?: string} $input */
        $input = $request->validated();
        $user = $this->accounts->update($admin, $user, $input);

        return response()->json(['message' => 'Perubahan tersimpan.', 'data' => $this->detailed($user)]);
    }

    public function mentorChange(User $user): JsonResponse
    {
        return response()->json(['data' => $this->users->mentorChangeImpact($user->loadMissing('internProfile.mentor'))]);
    }

    public function changeMentor(ChangeMentorRequest $request, User $user): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $mentor = User::query()->findOrFail($request->integer('mentor_id'));

        $this->accounts->changeMentor($admin, $user, $mentor, Date::now());

        return response()->json([
            'message' => 'Perubahan tersimpan. Mentor baru dan intern sudah diberi tahu.',
            'data' => $this->detailed($user->refresh()),
        ]);
    }

    public function deactivate(Request $request, User $user): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $user = $this->accounts->deactivate($admin, $user, Date::now());

        return response()->json(['message' => 'Perubahan tersimpan.', 'data' => $this->detailed($user)]);
    }

    public function activate(Request $request, User $user): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $user = $this->accounts->activate($admin, $user, Date::now());

        return response()->json(['message' => 'Perubahan tersimpan.', 'data' => $this->detailed($user)]);
    }

    public function extend(ExtendInternshipRequest $request, User $user): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $user = $this->accounts->extend($admin, $user, $request->string('end_date')->toString(), Date::now());

        return response()->json(['message' => 'Perubahan tersimpan.', 'data' => $this->detailed($user)]);
    }

    private function detailed(User $user): AdminUserResource
    {
        $user->load('internProfile.mentor:id,name');

        return (new AdminUserResource($user))->withDetail($this->users->detail($user, Date::now()));
    }
}
