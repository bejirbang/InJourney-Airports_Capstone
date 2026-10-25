<?php

namespace Database\Factories;

use App\Enums\AttendanceStatus;
use App\Enums\CorrectionStatus;
use App\Models\AttendanceCorrection;
use App\Models\InternProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AttendanceCorrection>
 */
class AttendanceCorrectionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'intern_id' => User::factory()->intern(),
            'mentor_id' => fn (array $attributes) => InternProfile::query()->where('user_id', $attributes['intern_id'])->value('mentor_id'),
            'date' => now()->subDay()->toDateString(),
            'recorded_status' => AttendanceStatus::Present,
            'recorded_missed_clock_out' => true,
            'reason' => 'Lupa clock out.',
            'status' => CorrectionStatus::PendingMentor,
        ];
    }

    public function pendingAdmin(string $mentorNote = 'Benar, intern hadir.'): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => CorrectionStatus::PendingAdmin,
            'mentor_note' => $mentorNote,
            'mentor_decided_at' => now(),
        ]);
    }

    public function rejectedByMentor(string $mentorNote = 'Tidak sesuai.'): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => CorrectionStatus::RejectedByMentor,
            'mentor_note' => $mentorNote,
            'mentor_decided_at' => now(),
        ]);
    }

    public function decidedByAdmin(CorrectionStatus $status, User $admin, string $note = 'Sesuai validasi mentor.'): static
    {
        return $this->pendingAdmin()->state(fn (array $attributes) => [
            'status' => $status,
            'admin_id' => $admin->id,
            'admin_note' => $note,
            'admin_decided_at' => now(),
        ]);
    }
}
