<?php

namespace App\Services;

use App\Enums\RequestStatus;
use App\Models\InternProfile;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Database\Query\Builder;

/**
 * Kuota izin per masa magang: 1 pengajuan = 1 kali berapa pun jumlah harinya. Yang dihitung pengajuan
 * Menunggu dan Disetujui yang dibuat sejak `leave_quota_since` (tanggal mulai, lalu tanggal admin menekan
 * Perpanjang).
 */
class LeaveQuotas
{
    public function __construct(private SystemSettings $settings) {}

    public function limit(): int
    {
        return $this->settings->leaveQuota();
    }

    public function exhaustedMessage(): string
    {
        return "Kuota izin Anda ({$this->limit()} kali) sudah habis. Silakan hubungi mentor.";
    }

    public function used(InternProfile $profile): int
    {
        return LeaveRequest::query()
            ->where('intern_id', $profile->user_id)
            ->countingQuota()
            ->where('created_at', '>=', $profile->leave_quota_since->copy()->startOfDay())
            ->count();
    }

    /**
     * @return array{used: int, limit: int, remaining: int, exhausted: bool}|null
     */
    public function summary(User $intern): ?array
    {
        $profile = $intern->internProfile;

        if ($profile === null) {
            return null;
        }

        $used = $this->used($profile);
        $limit = $this->limit();

        return [
            'used' => $used,
            'limit' => $limit,
            'remaining' => max(0, $limit - $used),
            'exhausted' => $used >= $limit,
        ];
    }

    /**
     * Subquery id intern yang kuotanya sudah habis, untuk filter "Kuota habis".
     */
    public function exhaustedInternIds(): Builder
    {
        return InternProfile::query()
            ->select('user_id')
            ->whereRaw(
                '(select count(*) from leave_requests where leave_requests.intern_id = intern_profiles.user_id'
                .' and leave_requests.status in (?, ?) and leave_requests.created_at >= intern_profiles.leave_quota_since) >= ?',
                [RequestStatus::Pending->value, RequestStatus::Approved->value, $this->limit()],
            )
            ->toBase();
    }
}
