<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
 * Channel WebSocket (Laravel Reverb). Otorisasi lewat POST /api/broadcasting/auth dengan token Sanctum.
 * Parameter channel berupa teks, jadi dibandingkan setelah diubah ke angka.
 */

// Notifikasi lonceng, pesan chat, dan sinkron status dibaca: hanya pemilik akun (backend/CLAUDE.md, Real time).
Broadcast::channel('users.{id}', fn (User $user, string $id): bool => $user->id === (int) $id);

// Indikator sedang mengetik (client event "typing") untuk satu percakapan. Id kecil lebih dulu,
// hanya dua peserta percakapan yang boleh bergabung.
Broadcast::channel('chats.{low}.{high}', function (User $user, string $low, string $high): bool {
    [$low, $high] = [(int) $low, (int) $high];

    return $low < $high
        && in_array($user->id, [$low, $high], true)
        && User::query()->whereKey($user->id === $low ? $high : $low)->exists();
});

// Status online: semua pengguna yang sedang membuka aplikasi. Anggota channel dipakai frontend sebagai daftar online.
Broadcast::channel('online', fn (User $user): array => ['id' => $user->id, 'name' => $user->name]);
