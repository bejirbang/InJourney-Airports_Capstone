<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Role;
use App\Exceptions\ActionRejected;
use App\Http\Controllers\Controller;
use App\Http\Requests\Shared\AttendanceHistoryRequest;
use App\Models\User;
use App\Services\AdminUsers;
use App\Services\AttendanceHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;

class InternRecordController extends Controller
{
    public const NOT_INTERN = 'Akun ini bukan intern.';

    public function attendance(AttendanceHistoryRequest $request, User $user, AttendanceHistory $history): JsonResponse
    {
        $intern = self::intern($user);

        return response()->json(['data' => $history->monthForAdmin($intern, $request->month(), $request->statusFilter(), Date::now())]);
    }

    public function day(User $user, string $date, AttendanceHistory $history): JsonResponse
    {
        return response()->json(['data' => $history->day(self::intern($user), $date, Date::now())]);
    }

    /**
     * Tab Logbook hanya baca; review adalah hak mentor.
     */
    public function logbooks(AttendanceHistoryRequest $request, User $user, AttendanceHistory $history): JsonResponse
    {
        return response()->json(['data' => $history->logbooks(self::intern($user), $request->month(), Date::now())]);
    }

    public function leaves(User $user, AdminUsers $users): JsonResponse
    {
        return response()->json(['data' => $users->leaves(self::intern($user))]);
    }

    public function corrections(User $user, AdminUsers $users): JsonResponse
    {
        return response()->json(['data' => $users->corrections(self::intern($user))]);
    }

    /**
     * @throws ActionRejected
     */
    public static function intern(User $user): User
    {
        if (! $user->hasRole(Role::Intern)) {
            throw new ActionRejected(self::NOT_INTERN, 'not_intern');
        }

        return $user->loadMissing('internProfile');
    }
}
