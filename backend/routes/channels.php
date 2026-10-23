<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

// Parameter channel berupa teks, jadi dibandingkan setelah diubah ke angka.

Broadcast::channel('users.{id}', fn (User $user, string $id): bool => $user->id === (int) $id);

Broadcast::channel('chats.{low}.{high}', function (User $user, string $low, string $high): bool {
    [$low, $high] = [(int) $low, (int) $high];

    return $low < $high
        && in_array($user->id, [$low, $high], true)
        && User::query()->whereKey($user->id === $low ? $high : $low)->exists();
});

Broadcast::channel('online', fn (User $user): array => ['id' => $user->id, 'name' => $user->name]);
