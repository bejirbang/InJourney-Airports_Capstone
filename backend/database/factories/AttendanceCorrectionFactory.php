<?php

namespace Database\Factories;

use App\Enums\RequestStatus;
use App\Models\AttendanceCorrection;
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
            'date' => now()->subDay()->toDateString(),
            'recorded_clock_in' => '08:00:00',
            'recorded_clock_out' => null,
            'requested_clock_in' => '08:00:00',
            'requested_clock_out' => '17:00:00',
            'reason' => 'Lupa clock out.',
            'status' => RequestStatus::Pending,
        ];
    }

    public function decided(RequestStatus $status, User $admin, string $note = 'Sesuai bukti.'): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => $status,
            'decided_by' => $admin->id,
            'decision_note' => $note,
            'final_clock_in' => $status === RequestStatus::Approved ? $attributes['requested_clock_in'] : null,
            'final_clock_out' => $status === RequestStatus::Approved ? $attributes['requested_clock_out'] : null,
            'decided_at' => now(),
        ]);
    }
}
