<?php

namespace App\Events;

use App\Models\Notification;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Sinkron status dibaca ke tab atau perangkat lain milik pengguna yang sama (keputusan pemilik repo 23 Okt 2026).
 * `ids` null berarti "Tandai semua dibaca". Event `.notifications.read` di `users.{id}`.
 */
class NotificationsRead implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    /**
     * @param  list<int>|null  $ids
     */
    public function __construct(public int $userId, public ?array $ids) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("users.{$this->userId}");
    }

    public function broadcastAs(): string
    {
        return 'notifications.read';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['ids' => $this->ids, 'unread_count' => Notification::unreadCountFor($this->userId)];
    }
}
