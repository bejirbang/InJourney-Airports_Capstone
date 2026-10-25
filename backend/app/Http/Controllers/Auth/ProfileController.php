<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class ProfileController extends Controller
{
    public const SAVED = 'Perubahan tersimpan.';

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $user->update(['phone' => $request->filled('phone') ? $request->string('phone')->value() : null]);

        return response()->json([
            'message' => self::SAVED,
            'data' => new UserResource(UserResource::withProfile($user)),
        ]);
    }
}
