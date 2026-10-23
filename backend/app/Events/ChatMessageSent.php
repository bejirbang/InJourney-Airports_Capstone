<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Pesan chat baru. Dikirim ke penerima dan ke pengirim (tab atau perangkat lain miliknya); frontend
 * mengabaikan pesan yang `id`-nya sudah ada. Event `.chat.message` di `users.{id}`.
 */
class ChatMessageSent implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    /**
     * @param  array{id: int, sender_id: int, receiver_id: int, body: string, read_at: string|null, created_at: string|null}  $message
     * @param  array{id: int, name: string}  $sender
     */
    public function __construct(public array $message, public array $sender) {}

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("users.{$this->message['receiver_id']}"),
            new PrivateChannel("users.{$this->message['sender_id']}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'chat.message';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['message' => $this->message, 'sender' => $this->sender];
    }
}
