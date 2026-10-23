<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Pembaca membuka percakapan: semua pesan dari `partner_id` sampai `last_read_id` sudah dibaca.
 * Ke pembaca untuk sinkron angka chat di tab lain, dan ke pengirim untuk tanda "Dibaca"
 * (keputusan pemilik repo 23 Okt 2026). Event `.chat.read` di `users.{id}`.
 */
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
