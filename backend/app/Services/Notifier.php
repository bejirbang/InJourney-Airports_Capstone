<?php

namespace App\Services;

use App\Models\Announcement;
use App\Models\Notification;

/**
 * Membuat baris lonceng notifikasi. Broadcast lewat Reverb belum dipasang;
 * saat dipasang, cukup tambahkan di sini setelah baris tersimpan.
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
            Notification::query()->create([
                'user_id' => $userId,
                'text' => $text,
                'link_path' => $path,
                'link_params' => $params,
            ]);
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
            Notification::query()->create([
                'user_id' => $userId,
                'announcement_id' => $announcement->id,
                'text' => $announcement->title,
                'link_path' => '/',
                'link_params' => ['announcement' => $announcement->id],
            ]);
        }
    }
}
