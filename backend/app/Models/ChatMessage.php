<?php

namespace App\Models;

use Database\Factories\ChatMessageFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Pesan chat satu lawan satu. Hanya pengirim dan penerima yang bisa membacanya; admin tidak punya akses
 * ke chat orang lain (backend/CLAUDE.md). Teks saja, tanpa ubah atau hapus (keputusan pemilik repo 23 Okt 2026).
 *
 * @property int $id
 * @property int $sender_id
 * @property int $receiver_id
 * @property string $body
 * @property Carbon|null $read_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $sender
 * @property-read User $receiver
 */
#[Fillable(['sender_id', 'receiver_id', 'body', 'read_at'])]
class ChatMessage extends Model
{
    /** @use HasFactory<ChatMessageFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }

    /**
     * Pesan dalam percakapan dua pengguna, ke arah mana pun.
     *
     * @param  Builder<ChatMessage>  $query
     * @return Builder<ChatMessage>
     */
    public function scopeBetween(Builder $query, int $a, int $b): Builder
    {
        return $query->where(fn (Builder $q) => $q
            ->where(fn (Builder $q) => $q->where('sender_id', $a)->where('receiver_id', $b))
            ->orWhere(fn (Builder $q) => $q->where('sender_id', $b)->where('receiver_id', $a)));
    }

    /**
     * Satu pesan, sama di API dan di event WebSocket. `read_at` untuk tanda "Dibaca".
     *
     * @return array{id: int, sender_id: int, receiver_id: int, body: string, read_at: string|null, created_at: string|null}
     */
    public function toItem(): array
    {
        return [
            'id' => $this->id,
            'sender_id' => $this->sender_id,
            'receiver_id' => $this->receiver_id,
            'body' => $this->body,
            'read_at' => $this->read_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
