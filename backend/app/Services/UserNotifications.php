<?php

namespace App\Services;

use App\Events\NotificationsRead;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Support\Facades\Date;

class UserNotifications
{
    public const PER_PAGE = 20;

    /**
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

    public function markRead(User $user, int $id): Notification
    {
        $notification = Notification::query()->where('user_id', $user->id)->findOrFail($id);

        if ($notification->read_at === null) {
            $notification->update(['read_at' => Date::now()]);
            NotificationsRead::dispatch($user->id, [$notification->id]);
        }

        return $notification;
    }

    public function markAllRead(User $user): void
    {
        $count = Notification::query()->where('user_id', $user->id)->unread()->update(['read_at' => Date::now()]);

        if ($count > 0) {
            NotificationsRead::dispatch($user->id, null);
        }
    }

    public function markChatRead(User $user, int $senderId): void
    {
        $notification = Notification::query()->where('user_id', $user->id)->where('chat_sender_id', $senderId)->unread()->first();

        if ($notification !== null) {
            $notification->update(['read_at' => Date::now()]);
            NotificationsRead::dispatch($user->id, [$notification->id]);
        }
    }
}
