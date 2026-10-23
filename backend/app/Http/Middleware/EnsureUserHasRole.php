<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    public const MESSAGE = 'Anda tidak memiliki akses.';

    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        /** @var User $user */
        $user = $request->user();

        $allowed = array_map(fn (string $role): Role => Role::from($role), $roles);

        if (! in_array($user->role, $allowed, true)) {
            return response()->json(['message' => self::MESSAGE], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
