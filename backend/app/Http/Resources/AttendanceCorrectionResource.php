<?php

namespace App\Http\Resources;

use App\Enums\CorrectionStatus;
use App\Enums\Role;
use App\Models\AttendanceCorrection;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Dipakai ketiga role. `can_cancel` untuk intern pemilik, `can_decide` untuk pihak yang sedang ditunggu.
 *
 * @mixin AttendanceCorrection
 */
class AttendanceCorrectionResource extends JsonResource
{
    /** @var array<string, mixed>|null */
    private ?array $detail = null;

    /**
     * @param  array<string, mixed>  $detail
     */
    public function withDetail(array $detail): static
    {
        $this->detail = $detail;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var User|null $user */
        $user = $request->user();

        return [
            'id' => $this->id,
            'intern' => $this->whenLoaded('intern', fn (): array => [
                'id' => $this->intern->id,
                'name' => $this->intern->name,
                'short_name' => $this->intern->shortName(),
            ]),
            'date' => $this->date->toDateString(),
            'recorded_status' => $this->recorded_status->value,
            'recorded_missed_clock_out' => $this->recorded_missed_clock_out,
            'reason' => $this->reason,
            'status' => $this->status->value,
            'submitted_at' => $this->created_at?->toIso8601String(),
            'mentor' => $this->mentor === null ? null : ['id' => $this->mentor->id, 'name' => $this->mentor->name],
            'mentor_note' => $this->mentor_note,
            'mentor_decided_at' => $this->mentor_decided_at?->toIso8601String(),
            'admin' => $this->admin === null ? null : ['id' => $this->admin->id, 'name' => $this->admin->name],
            'admin_note' => $this->admin_note,
            'admin_decided_at' => $this->admin_decided_at?->toIso8601String(),
            'can_cancel' => $user?->role === Role::Intern && $this->isActive(),
            'can_decide' => match ($user?->role) {
                Role::Mentor => $this->status === CorrectionStatus::PendingMentor && $this->mentor_id === $user->id,
                Role::Admin => $this->status === CorrectionStatus::PendingAdmin,
                default => false,
            },
            ...($this->detail ?? []),
        ];
    }
}
