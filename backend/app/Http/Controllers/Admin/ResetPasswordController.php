<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

/**
 * Admin mereset password pengguna lain. Sistem membuat password sementara
 * yang hanya dikembalikan sekali di respons ini; admin tidak mengetik password sendiri.
 */
class ResetPasswordController extends Controller
{
    public function __invoke(Request $request, User $user): JsonResponse
    {
        Gate::authorize('resetPassword', $user);

        /** @var User $admin */
        $admin = $request->user();

        $temporaryPassword = Str::password(12, symbols: false);

        DB::transaction(function () use ($user, $admin, $temporaryPassword): void {
            $user->update([
                'password' => $temporaryPassword,
                'must_change_password' => true,
            ]);

            // Semua sesi pengguna itu berakhir; ia harus login lagi dengan password sementara.
            $user->tokens()->delete();

            AuditLog::record($admin, AuditLog::ACTION_ACCOUNT, $user->name, 'Reset password.');
        });

        return response()->json([
            'temporary_password' => $temporaryPassword,
        ]);
    }
}
