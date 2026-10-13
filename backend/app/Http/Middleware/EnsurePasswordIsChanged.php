<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Selama password sementara belum diganti, semua endpoint ditolak
 * kecuali yang tidak memakai middleware ini (ganti password, profil saya, logout).
 */
class EnsurePasswordIsChanged
{
    public const MESSAGE = 'Ganti password sementara Anda terlebih dahulu.';

    public function handle(Request $request, Closure $next): Response
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->must_change_password) {
            return response()->json([
                'message' => self::MESSAGE,
                'must_change_password' => true,
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
