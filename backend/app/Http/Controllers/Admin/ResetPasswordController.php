<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\AccountManagement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class ResetPasswordController extends Controller
{
    public function __invoke(Request $request, User $user): JsonResponse
    {
        Gate::authorize('resetPassword', $user);

        /** @var User $admin */
        $admin = $request->user();

        $temporaryPassword = AccountManagement::temporaryPassword();

        DB::transaction(function () use ($user, $admin, $temporaryPassword): void {
            $user->update([
                'password' => $temporaryPassword,
                'must_change_password' => true,
            ]);

            $user->tokens()->delete();

            AuditLog::record($admin, AuditLog::ACTION_ACCOUNT, $user->name, 'Reset password.');
        });

        return response()->json([
            'temporary_password' => $temporaryPassword,
        ]);
    }
}
