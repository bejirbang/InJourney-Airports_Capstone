<?php

namespace Database\Factories;

use App\Enums\LogbookStatus;
use App\Models\Attendance;
use App\Models\Logbook;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Logbook>
 */
class LogbookFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'attendance_id' => Attendance::factory(),
            'work' => fake()->sentence(),
            'notes' => null,
            'status' => LogbookStatus::Draft,
        ];
    }

    public function pendingReview(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => LogbookStatus::PendingReview,
            'submitted_at' => now(),
        ]);
    }

    public function approved(?User $mentor = null): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => LogbookStatus::Approved,
            'submitted_at' => now(),
            'approved_at' => now(),
            'approved_by' => $mentor?->id,
        ]);
    }

    public function revision(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => LogbookStatus::Revision,
            'submitted_at' => now(),
        ]);
    }
}
