<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Isi lonceng notifikasi. Tabel sendiri, bukan channel `database` bawaan Laravel.
 * `link_path` dan `link_params` adalah halaman tujuan di frontend saat item diklik.
 * `created_at` adalah waktu kejadian terakhir: notifikasi chat diperbarui setiap ada pesan baru dari pengirim yang sama.
 *
 * @property int $id
 * @property int $user_id
 * @property int|null $announcement_id terisi untuk notifikasi pengumuman, agar ikut diubah dan dihapus
 * @property int|null $chat_sender_id terisi untuk notifikasi "Pesan baru dari ...", satu baris per pengirim
 * @property string $text
 * @property string $link_path
 * @property array<string, mixed>|null $link_params
 * @property Carbon|null $read_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 */
#[Fillable(['user_id', 'announcement_id', 'chat_sender_id', 'text', 'link_path', 'link_params', 'read_at'])]
class Notification extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'link_params' => 'array',
            'read_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @param  Builder<Notification>  $query
     * @return Builder<Notification>
     */
    public function scopeUnread(Builder $query): Builder
    {
        return $query->whereNull('read_at');
    }

    public static function unreadCountFor(int $userId): int
    {
        return self::query()->where('user_id', $userId)->unread()->count();
    }

    /**
     * Satu item lonceng, sama di API dan di event WebSocket.
     *
     * @return array{id: int, text: string, link_path: string, link_params: array<string, mixed>|null, read_at: string|null, created_at: string|null}
     */
    public function toItem(): array
    {
        return [
            'id' => $this->id,
            'text' => $this->text,
            'link_path' => $this->link_path,
            'link_params' => $this->link_params,
            'read_at' => $this->read_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
