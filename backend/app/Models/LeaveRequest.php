<?php

namespace App\Models;

use App\Enums\LeaveType;
use App\Enums\RequestStatus;
use Carbon\CarbonInterface;
use Database\Factories\LeaveRequestFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $intern_id
 * @property LeaveType $type
 * @property Carbon $start_date
 * @property Carbon $end_date
 * @property string $reason
 * @property string|null $evidence_path
 * @property RequestStatus $status
 * @property int|null $decided_by
 * @property string|null $decision_note
 * @property Carbon|null $decided_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $intern
 * @property-read User|null $decider
 */
#[Fillable([
    'intern_id', 'type', 'start_date', 'end_date', 'reason', 'evidence_path',
    'status', 'decided_by', 'decision_note', 'decided_at',
])]
class LeaveRequest extends Model
{
    /** @use HasFactory<LeaveRequestFactory> */
    use HasFactory;

    /** Izin Pending lebih dari 24 jam (design-mentor.md 4.2 dan 9.2, design-admin.md Alur 5). */
    public const OVERDUE_PENDING_HOURS = 24;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => LeaveType::class,
            'start_date' => 'date',
            'end_date' => 'date',
            'status' => RequestStatus::class,
            'decided_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function intern(): BelongsTo
    {
        return $this->belongsTo(User::class, 'intern_id');
    }

    /**
     * Mentor atau admin yang memutuskan; role-nya menentukan teks "Diproses oleh admin".
     *
     * @return BelongsTo<User, $this>
     */
    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by')->withTrashed();
    }

    /**
     * Izin disetujui yang rentangnya bersinggungan dengan $from sampai $to (Y-m-d).
     *
     * @param  Builder<LeaveRequest>  $query
     * @return Builder<LeaveRequest>
     */
    public function scopeApprovedBetween(Builder $query, string $from, string $to): Builder
    {
        return $query->where('status', RequestStatus::Approved)
            ->whereDate('start_date', '<=', $to)
            ->whereDate('end_date', '>=', $from);
    }

    /**
     * Lama pending dalam jam ("diajukan 14 jam lalu", "26 jam"); null jika bukan Pending.
     * Sama dengan pendingHours di frontend/src/lib/mock-rules.ts.
     */
    public function pendingHours(CarbonInterface $now): ?int
    {
        $minutes = $this->pendingMinutes($now);

        return $minutes === null ? null : intdiv($minutes, 60);
    }

    /**
     * Pending lebih dari 24 jam: tanda "!" untuk mentor dan pengingat di dashboard admin.
     * Sama dengan isOverduePending di frontend/src/lib/mock-rules.ts.
     */
    public function isOverduePending(CarbonInterface $now): bool
    {
        $minutes = $this->pendingMinutes($now);

        return $minutes !== null && $minutes > self::OVERDUE_PENDING_HOURS * 60;
    }

    private function pendingMinutes(CarbonInterface $now): ?int
    {
        if ($this->status !== RequestStatus::Pending || $this->created_at === null) {
            return null;
        }

        return max(0, (int) floor($this->created_at->diffInMinutes($now)));
    }

    /**
     * Nama unduhan lampiran, misalnya "lampiran-izin-2026-10-13.pdf".
     */
    public function evidenceFileName(): string
    {
        return "lampiran-izin-{$this->start_date->toDateString()}.".pathinfo((string) $this->evidence_path, PATHINFO_EXTENSION);
    }

    public function covers(string $date): bool
    {
        return $this->start_date->toDateString() <= $date && $date <= $this->end_date->toDateString();
    }
}
