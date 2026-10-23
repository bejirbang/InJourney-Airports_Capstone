<?php

namespace App\Services;

use App\Enums\RequestStatus;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class AdminLeaves
{
    /**
     * @param  array{tab?: string|null, type?: string|null, intern_id?: int|null}  $filters
     * @return array{leaves: Collection<int, LeaveRequest>, pending_count: int}
     */
    public function list(array $filters): array
    {
        $base = LeaveRequest::query()->whereHas('intern');

        $leaves = $base->clone()
            ->with(['intern:id,name', 'intern.internProfile.mentor:id,name', 'decider:id,name,role'])
            ->when(($filters['tab'] ?? 'pending') === 'pending', fn (Builder $q) => $q->where('status', RequestStatus::Pending))
            ->when($filters['type'] ?? null, fn (Builder $q, string $type) => $q->where('type', $type))
            ->when($filters['intern_id'] ?? null, fn (Builder $q, int $id) => $q->where('intern_id', $id))
            ->orderByRaw('CASE WHEN status = ? THEN 0 ELSE 1 END', [RequestStatus::Pending->value])
            ->orderByRaw('CASE WHEN status = ? THEN created_at END ASC', [RequestStatus::Pending->value])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        return [
            'leaves' => $leaves,
            'pending_count' => $base->clone()->where('status', RequestStatus::Pending)->count(),
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
