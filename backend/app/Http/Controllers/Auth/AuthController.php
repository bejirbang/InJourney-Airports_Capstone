<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AccountAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public const INVALID_CREDENTIALS = 'Email atau password salah.';

    public const PASSWORD_CHANGE_NOT_ALLOWED = 'Password hanya bisa diganti saat login pertama atau setelah direset admin.';

    public function login(LoginRequest $request, AccountAccess $access): JsonResponse
    {
        $user = User::query()
            ->with('internProfile')
            ->where('email', mb_strtolower(trim($request->string('email')->value())))
            ->first();

        if ($user === null || ! Hash::check($request->string('password')->value(), $user->password)) {
            throw ValidationException::withMessages(['email' => self::INVALID_CREDENTIALS]);
        }

        // Status akun baru diperiksa setelah password benar, agar tidak membocorkan email yang terdaftar.
        $reason = $access->denialReason($user);

        if ($reason !== null) {
            return response()->json(['message' => $reason], Response::HTTP_FORBIDDEN);
        }

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user),
        ]);
    }

    public function me(Request $request): UserResource
    {
        /** @var User $user */
        $user = $request->user();

        return new UserResource($user->loadMissing('internProfile'));
    }

    public function logout(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $user->currentAccessToken()->delete();

        return response()->noContent();
    }

    /**
     * Ganti password sementara (login pertama atau setelah reset admin).
     * Tidak ada ganti password mandiri di luar kondisi itu.
     */
    public function changePassword(ChangePasswordRequest $request): JsonResponse|UserResource
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->must_change_password) {
            return response()->json(['message' => self::PASSWORD_CHANGE_NOT_ALLOWED], Response::HTTP_FORBIDDEN);
        }

        $currentTokenId = $user->currentAccessToken()->getKey();

        DB::transaction(function () use ($user, $request, $currentTokenId): void {
            $user->update([
                'password' => $request->string('password')->value(),
                'must_change_password' => false,
            ]);

            // Sesi lain yang masih memakai password sementara ikut keluar.
            $user->tokens()->whereKeyNot($currentTokenId)->delete();
        });

        return new UserResource($user->loadMissing('internProfile'));
    }
}
