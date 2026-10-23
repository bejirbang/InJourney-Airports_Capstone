<?php

namespace App\Services;

use App\Events\NotificationsRead;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Support\Facades\Date;

/**
 * Lonceng notifikasi untuk semua role (design-intern.md 14.2 dan 16, design-mentor.md 12.2 dan 14, design-admin.md 14).
 * Tidak ada halaman notifikasi terpisah; frontend memuat daftar sedikit demi sedikit di popup lonceng.
 * Setiap perubahan status dibaca dikirim ke tab dan perangkat lain milik pengguna itu (NotificationsRead).
 */
class UserNotifications
{
    public const PER_PAGE = 20;

    /**
     * Terbaru lebih dulu, berdasarkan waktu kejadian terakhir.
     *
     * @return CursorPaginator<int, Notification>
     */
    public function page(User $user): CursorPaginator
    {
        return Notification::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->cursorPaginate(self::PER_PAGE);
    }

    /**
     * Item diklik: tandai dibaca. Notifikasi milik orang lain dianggap tidak ada (404).
     */
    public function markRead(User $user, int $id): Notification
    {
        $notification = Notification::query()->where('user_id', $user->id)->findOrFail($id);

        if ($notification->read_at === null) {
            $notification->update(['read_at' => Date::now()]);
            NotificationsRead::dispatch($user->id, [$notification->id]);
        }

        return $notification;
    }

    /**
     * "Tandai semua dibaca".
     */
    public function markAllRead(User $user): void
    {
        $count = Notification::query()->where('user_id', $user->id)->unread()->update(['read_at' => Date::now()]);

        if ($count > 0) {
            NotificationsRead::dispatch($user->id, null);
        }
    }

    /**
     * Membuka percakapan dengan $senderId ikut membaca notifikasi "Pesan baru dari ..." dari orang itu.
     */
    public function markChatRead(User $user, int $senderId): void
    {
        $notification = Notification::query()->where('user_id', $user->id)->where('chat_sender_id', $senderId)->unread()->first();

        if ($notification !== null) {
            $notification->update(['read_at' => Date::now()]);
            NotificationsRead::dispatch($user->id, [$notification->id]);
        }
    }
}
