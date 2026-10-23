<?php

namespace App\Events;

use App\Models\Notification;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

class NotificationSent implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    /**
     * @param  array{id: int, text: string, link_path: string, link_params: array<string, mixed>|null, read_at: string|null, created_at: string|null}  $notification
     */
    public function __construct(public int $userId, public array $notification) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("users.{$this->userId}");
    }

    public function broadcastAs(): string
    {
        return 'notification.sent';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        // Dihitung saat dikirim agar angka lonceng sama dengan isi database terbaru.
        return ['notification' => $this->notification, 'unread_count' => Notification::unreadCountFor($this->userId)];
    }
}
