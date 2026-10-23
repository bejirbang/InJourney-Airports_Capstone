<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

class ChatMessagesRead implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public int $readerId, public int $partnerId, public int $lastReadId, public string $readAt) {}

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("users.{$this->readerId}"),
            new PrivateChannel("users.{$this->partnerId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'chat.read';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'reader_id' => $this->readerId,
            'partner_id' => $this->partnerId,
            'last_read_id' => $this->lastReadId,
            'read_at' => $this->readAt,
        ];
    }
}
