<?php

namespace App\Services;

use App\Enums\RequestStatus;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Halaman Izin mentor (docs/design-mentor.md, Alur 7): izin milik intern yang saat ini dibimbing.
 * Izin pending ikut pindah saat admin mengganti mentor, jadi acuannya `intern_profiles.mentor_id`.
 * Akses per izin di LeaveRequestPolicy::manage.
 */
class MentorLeaves
{
    /**
     * Tab Pending (default) atau Semua, filter jenis dan intern.
     * Pending lebih dulu, dari yang paling lama pending (9.2); sisanya pengajuan terbaru lebih dulu.
     *
     * @param  array{tab?: string|null, type?: string|null, intern_id?: int|string|null}  $filters
     * @return array{leaves: Collection<int, LeaveRequest>, pending_count: int}
     */
    public function list(User $mentor, array $filters): array
    {
        $base = LeaveRequest::query()
            ->whereHas('intern.internProfile', fn (Builder $q) => $q->where('mentor_id', $mentor->id));

        $leaves = $base->clone()
            ->with(['intern:id,name', 'decider:id,name,role'])
            ->when(($filters['tab'] ?? 'pending') === 'pending', fn (Builder $q) => $q->where('status', RequestStatus::Pending))
            ->when($filters['type'] ?? null, fn (Builder $q, string $type) => $q->where('type', $type))
            ->when($filters['intern_id'] ?? null, fn (Builder $q, int|string $id) => $q->where('intern_id', (int) $id))
            ->orderByRaw('CASE WHEN status = ? THEN 0 ELSE 1 END', [RequestStatus::Pending->value])
            ->orderByRaw('CASE WHEN status = ? THEN created_at END ASC', [RequestStatus::Pending->value])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        return [
            'leaves' => $leaves,
            // Angka di tab "Pending (2)", tanpa terpengaruh filter.
            'pending_count' => $base->clone()->where('status', RequestStatus::Pending)->count(),
        ];
    }
}
