<?php

namespace App\Services;

use App\Enums\RequestStatus;
use App\Models\LeaveRequest;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class AdminLeaves
{
    public function __construct(private SystemSettings $settings, private LeaveQuotas $quotas) {}

    /**
     * Tab "pending" hanya berisi izin yang menunggu lebih dari batas eskalasi, karena hanya itu yang
     * diputuskan admin. "Kuota habis" menyaring intern yang sudah memakai seluruh kuotanya.
     *
     * @param  array{tab?: string|null, type?: string|null, intern_id?: int|null, quota_exhausted?: bool}  $filters
     * @return array{leaves: Collection<int, LeaveRequest>, pending_count: int}
     */
    public function list(array $filters, CarbonInterface $now): array
    {
        $hours = $this->settings->leaveEscalationHours();
        $base = LeaveRequest::query()
            ->whereHas('intern')
            ->when($filters['quota_exhausted'] ?? false, fn (Builder $q) => $q->whereIn('intern_id', $this->quotas->exhaustedInternIds()));

        $leaves = $base->clone()
            ->with(['intern:id,name', 'intern.internProfile.mentor:id,name', 'decider:id,name,role'])
            ->when(($filters['tab'] ?? 'pending') === 'pending', fn (Builder $q) => $q->overduePending($now, $hours))
            ->when($filters['type'] ?? null, fn (Builder $q, string $type) => $q->where('type', $type))
            ->when($filters['intern_id'] ?? null, fn (Builder $q, int $id) => $q->where('intern_id', $id))
            ->orderByRaw('CASE WHEN status = ? THEN 0 ELSE 1 END', [RequestStatus::Pending->value])
            ->orderByRaw('CASE WHEN status = ? THEN created_at END ASC', [RequestStatus::Pending->value])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        return [
            'leaves' => $leaves,
            'pending_count' => $base->clone()->overduePending($now, $hours)->count(),
        ];
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    public function interns(): array
    {
        return array_values(User::query()
            ->whereHas('leaveRequests')
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $intern): array => ['id' => $intern->id, 'name' => $intern->name])
            ->all());
    }
}
