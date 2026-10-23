<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\Announcement;
use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Menu Pengumuman (docs/design-admin.md Alur 9). Admin memilih role penerima; pengumuman tampil di lonceng
 * penerima dan di kotak Pengumuman Dashboard intern dan mentor.
 *
 * Notifikasi lonceng mengikuti pengumumannya (keputusan pemilik repo 23 Okt 2026): ubah judul mengganti teks
 * notifikasi tanpa mengubah status dibaca, role yang ditambahkan mendapat notifikasi, role yang dicabut
 * kehilangan notifikasinya, dan hapus pengumuman ikut menghapus notifikasinya.
 *
 * Penerima: akun role itu yang tidak dinonaktifkan; untuk intern termasuk yang belum mulai magang,
 * tetapi tidak yang magangnya sudah berakhir.
 */
class AdminAnnouncements
{
    public function __construct(private Notifier $notifier) {}

    /**
     * Semua pengumuman, terbaru lebih dulu.
     *
     * @return Collection<int, Announcement>
     */
    public function all(): Collection
    {
        return Announcement::query()->with('author:id,name')->latest()->latest('id')->get();
    }

    /**
     * @param  array{title: string, body: string, for_intern: bool, for_mentor: bool}  $data
     */
    public function create(User $admin, array $data, CarbonInterface $now): Announcement
    {
        return DB::transaction(function () use ($admin, $data, $now): Announcement {
            $announcement = Announcement::query()->create([...$data, 'author_id' => $admin->id]);

            foreach ($this->roles($announcement) as $role) {
                $this->notifier->announce($this->recipients(Role::from($role), $now), $announcement);
            }

            AuditLog::record($admin, AuditLog::ACTION_ANNOUNCEMENT, $announcement->title, "Buat pengumuman untuk {$this->audience($announcement)}.");

            return $announcement->load('author:id,name');
        });
    }

    /**
     * Ubah judul, isi, atau penerima. Simpan tanpa perubahan tidak dicatat di log.
     *
     * @param  array{title: string, body: string, for_intern: bool, for_mentor: bool}  $data
     */
    public function update(User $admin, Announcement $announcement, array $data, CarbonInterface $now): Announcement
    {
        return DB::transaction(function () use ($admin, $announcement, $data, $now): Announcement {
            $announcement = Announcement::query()->lockForUpdate()->findOrFail($announcement->id);
            $before = $this->roles($announcement);

            $announcement->fill($data);

            if (! $announcement->isDirty()) {
                return $announcement->load('author:id,name');
            }

            $titleChanged = $announcement->isDirty('title');
            $announcement->save();
            $after = $this->roles($announcement);

            if ($titleChanged) {
                Notification::query()->where('announcement_id', $announcement->id)->update(['text' => $announcement->title]);
            }

            foreach (array_diff($before, $after) as $removed) {
                Notification::query()
                    ->where('announcement_id', $announcement->id)
                    ->whereHas('user', fn (Builder $q) => $q->where('role', Role::from($removed)))
                    ->delete();
            }

            foreach (array_diff($after, $before) as $added) {
                $this->notifier->announce($this->recipients(Role::from($added), $now), $announcement);
            }

            $detail = $before === $after ? 'Ubah pengumuman.' : "Ubah pengumuman, penerima kini {$this->audience($announcement)}.";
            AuditLog::record($admin, AuditLog::ACTION_ANNOUNCEMENT, $announcement->title, $detail);

            return $announcement->load('author:id,name');
        });
    }

    /**
     * Hapus pengumuman; notifikasinya ikut terhapus (foreign key cascade).
     */
    public function delete(User $admin, Announcement $announcement): void
    {
        DB::transaction(function () use ($admin, $announcement): void {
            $announcement->delete();

            AuditLog::record($admin, AuditLog::ACTION_ANNOUNCEMENT, $announcement->title, 'Hapus pengumuman.');
        });
    }

    /**
     * Penerima notifikasi untuk satu role.
     *
     * @return list<int>
     */
    private function recipients(Role $role, CarbonInterface $now): array
    {
        return array_values(User::query()
            ->where('role', $role)
            ->where('is_active', true)
            ->when($role === Role::Intern, fn (Builder $q) => $q->whereHas(
                'internProfile',
                fn (Builder $p) => $p->whereDate('end_date', '>=', $now->toDateString()),
            ))
            ->orderBy('id')
            ->get(['id'])
            ->map(fn (User $user): int => $user->id)
            ->all());
    }

    /**
     * Role penerima pengumuman, dalam nilai enum agar mudah dibandingkan.
     *
     * @return list<string>
     */
    private function roles(Announcement $announcement): array
    {
        return array_values(array_filter([
            $announcement->for_intern ? Role::Intern->value : null,
            $announcement->for_mentor ? Role::Mentor->value : null,
        ]));
    }

    /**
     * "Intern", "Mentor", atau "Intern dan Mentor".
     */
    private function audience(Announcement $announcement): string
    {
        return implode(' dan ', array_map(fn (string $role): string => Role::from($role)->label(), $this->roles($announcement)));
    }
}
