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

class AdminAnnouncements
{
    public function __construct(private Notifier $notifier) {}

    /**
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
            $changed = [];

            if ($titleChanged) {
                $changed = $this->notifiedUsers($announcement);
                Notification::query()->where('announcement_id', $announcement->id)->update(['text' => $announcement->title]);
            }

            foreach (array_diff($before, $after) as $removed) {
                $rows = Notification::query()
                    ->where('announcement_id', $announcement->id)
                    ->whereHas('user', fn (Builder $q) => $q->where('role', Role::from($removed)));

                $changed = [...$changed, ...$rows->clone()->get(['user_id'])->map(fn (Notification $n): int => $n->user_id)->all()];
                $rows->delete();
            }

            $this->notifier->changed(array_unique($changed));

            foreach (array_diff($after, $before) as $added) {
                $this->notifier->announce($this->recipients(Role::from($added), $now), $announcement);
            }

            $detail = $before === $after ? 'Ubah pengumuman.' : "Ubah pengumuman, penerima kini {$this->audience($announcement)}.";
            AuditLog::record($admin, AuditLog::ACTION_ANNOUNCEMENT, $announcement->title, $detail);

            return $announcement->load('author:id,name');
        });
    }

    public function delete(User $admin, Announcement $announcement): void
    {
        DB::transaction(function () use ($admin, $announcement): void {
            $notified = $this->notifiedUsers($announcement);
            $announcement->delete();
            $this->notifier->changed($notified);

            AuditLog::record($admin, AuditLog::ACTION_ANNOUNCEMENT, $announcement->title, 'Hapus pengumuman.');
        });
    }

    /**
     * @return list<int>
     */
    private function recipients(Role $role, CarbonInterface $now): array
    {
        return array_values(User::query()
            ->where('role', $role)
            ->reachable($now->toDateString())
            ->orderBy('id')
            ->get(['id'])
            ->map(fn (User $user): int => $user->id)
            ->all());
    }

    /**
     * @return list<int>
     */
    private function notifiedUsers(Announcement $announcement): array
    {
        return array_values(Notification::query()
            ->where('announcement_id', $announcement->id)
            ->get(['user_id'])
            ->map(fn (Notification $notification): int => $notification->user_id)
            ->all());
    }

    /**
     * @return list<string>
     */
    private function roles(Announcement $announcement): array
    {
        return array_values(array_filter([
            $announcement->for_intern ? Role::Intern->value : null,
            $announcement->for_mentor ? Role::Mentor->value : null,
        ]));
    }

    private function audience(Announcement $announcement): string
    {
        return implode(' dan ', array_map(fn (string $role): string => Role::from($role)->label(), $this->roles($announcement)));
    }
}
