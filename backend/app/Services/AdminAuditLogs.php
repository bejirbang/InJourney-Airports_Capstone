<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * Log Aktivitas (docs/design-admin.md 13.1). Hanya baca. Kolom Admin memakai nama yang tersimpan saat tindakan
 * dilakukan (`admin_name`), jadi tetap terbaca walau nama atau akun admin berubah.
 */
class AdminAuditLogs
{
    public const PER_PAGE = 20;

    /**
     * Terbaru lebih dulu.
     *
     * @param  array{from: string|null, to: string|null, admin_id: int|null, action: string|null}  $filters
     * @return LengthAwarePaginator<int, AuditLog>
     */
    public function list(array $filters): LengthAwarePaginator
    {
        return AuditLog::query()
            ->when($filters['from'], fn (Builder $q, string $from) => $q->whereDate('created_at', '>=', $from))
            ->when($filters['to'], fn (Builder $q, string $to) => $q->whereDate('created_at', '<=', $to))
            ->when($filters['admin_id'], fn (Builder $q, int $id) => $q->where('admin_id', $id))
            ->when($filters['action'], fn (Builder $q, string $action) => $q->where('action', $action))
            ->latest()
            ->latest('id')
            ->paginate(self::PER_PAGE);
    }

    /**
     * Pilihan filter: admin yang pernah tercatat di log (nama saat ini, termasuk akun nonaktif atau terhapus)
     * dan semua jenis aksi.
     *
     * @return array{admins: list<array{id: int, name: string}>, actions: list<string>}
     */
    public function options(): array
    {
        $admins = User::withTrashed()
            ->whereIn('id', AuditLog::query()->whereNotNull('admin_id')->select('admin_id'))
            ->orderBy('name')
            ->orderBy('id')
            ->get(['id', 'name']);

        return [
            'admins' => array_values($admins->map(fn (User $admin): array => ['id' => $admin->id, 'name' => $admin->name])->all()),
            'actions' => AuditLog::ACTIONS,
        ];
    }
}
