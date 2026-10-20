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

/**
 * Tab Absensi, Izin, dan Koreksi di detail intern (docs/design-admin.md 4.3). Hanya baca.
 * Tab Profil ada di UserController::show, tab Warning di WarningController.
 */
class InternRecordController extends Controller
{
    public const NOT_INTERN = 'Akun ini bukan intern.';

    /**
     * Rekap dan riwayat harian satu bulan (`?month=2026-10`), dengan tanda Terlambat.
     */
    public function attendance(AttendanceHistoryRequest $request, User $user, AttendanceHistory $history): JsonResponse
    {
        $intern = self::intern($user);
        $month = $request->filled('month') ? $request->string('month')->value() : null;

        return response()->json(['data' => $history->monthForAdmin($intern, $month, Date::now())]);
    }

    /**
     * Detail satu hari: jam, status, Terlambat, kantor clock in dan clock out, Daily Report.
     */
    public function day(User $user, string $date, AttendanceHistory $history): JsonResponse
    {
        return response()->json(['data' => $history->day(self::intern($user), $date, Date::now())]);
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
