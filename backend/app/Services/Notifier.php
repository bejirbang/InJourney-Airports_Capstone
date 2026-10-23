<?php

namespace App\Services;

use App\Events\NotificationsChanged;
use App\Events\NotificationSent;
use App\Models\Announcement;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;

/**
 * Satu-satunya tempat membuat baris lonceng notifikasi. Setiap baris disimpan lebih dulu, lalu dikirim lewat
 * WebSocket (Reverb, private channel `users.{id}`) setelah transaksi selesai (backend/CLAUDE.md, Real time).
 */
class Notifier
{
    /**
     * @param  iterable<int>  $userIds
     * @param  array<string, mixed>|null  $params  parameter URL frontend, misalnya ['open' => 12]
     */
    public function send(iterable $userIds, string $text, string $path, ?array $params = null): void
    {
        foreach ($userIds as $userId) {
            $this->deliver(Notification::query()->create([
                'user_id' => $userId,
                'text' => $text,
                'link_path' => $path,
                'link_params' => $params,
            ]));
        }
    }

    /**
     * Notifikasi pengumuman: teks berupa judul pengumuman (design-intern.md 16, design-mentor.md 14), klik membuka
     * isinya. Baris disambungkan ke pengumuman agar ikut berubah dan terhapus bersama pengumumannya.
     *
     * @param  iterable<int>  $userIds
     */
    public function announce(iterable $userIds, Announcement $announcement): void
    {
        foreach ($userIds as $userId) {
            $this->deliver(Notification::query()->create([
                'user_id' => $userId,
                'announcement_id' => $announcement->id,
                'text' => $announcement->title,
                'link_path' => '/',
                'link_params' => ['announcement' => $announcement->id],
            ]));
        }
    }

    /**
     * "Pesan baru dari Bu Sari." satu baris per pengirim (keputusan pemilik repo 23 Okt 2026): pesan berikutnya
     * dari orang yang sama menjadikan baris itu belum dibaca lagi dan memindahkannya ke atas, tanpa baris baru.
     */
    public function chatMessage(User $receiver, User $sender): void
    {
        $values = [
            'text' => "Pesan baru dari {$sender->name}.",
            'read_at' => null,
            'created_at' => Date::now(),
            'updated_at' => Date::now(),
        ];
        $existing = fn () => Notification::query()->where('user_id', $receiver->id)->where('chat_sender_id', $sender->id);

        if ($existing()->update($values) === 0) {
            try {
                // Savepoint: bila pesan lain dari pengirim yang sama membuat baris lebih dulu, transaksi luar tetap jalan.
                DB::transaction(fn () => Notification::query()->create([
                    'user_id' => $receiver->id,
                    'chat_sender_id' => $sender->id,
                    'text' => $values['text'],
                    'link_path' => '/chat',
                    'link_params' => ['to' => $sender->id],
                ]));
            } catch (UniqueConstraintViolationException) {
                $existing()->update($values);
            }
        }

        $this->deliver($existing()->firstOrFail());
    }

    /**
     * Isi lonceng pengguna berubah tanpa item baru (judul pengumuman diubah, pengumuman dihapus).
     *
     * @param  iterable<int>  $userIds
     */
    public function changed(iterable $userIds): void
    {
        foreach ($userIds as $userId) {
            NotificationsChanged::dispatch($userId);
        }
    }

    private function deliver(Notification $notification): void
    {
        NotificationSent::dispatch($notification->user_id, $notification->toItem());
    }
}
