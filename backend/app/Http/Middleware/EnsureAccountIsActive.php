<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\AccountAccess;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Menolak token milik akun yang sudah nonaktif atau di luar masa magang,
 * lalu mencabut token itu agar pengguna kembali ke layar login.
 */
class EnsureAccountIsActive
{
    public function __construct(private AccountAccess $access) {}

    public function handle(Request $request, Closure $next): Response
    {
        /** @var User $user */
        $user = $request->user();

        $reason = $this->access->denialReason($user);

        if ($reason !== null) {
            $user->currentAccessToken()->delete();

            return response()->json(['message' => $reason], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
