<?php

namespace Database\Factories;

use App\Enums\LeaveType;
use App\Enums\RequestStatus;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LeaveRequest>
 */
class LeaveRequestFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'intern_id' => User::factory()->intern(),
            'type' => LeaveType::Sick,
            'start_date' => now()->toDateString(),
            'end_date' => now()->toDateString(),
            'reason' => fake()->sentence(),
            'status' => RequestStatus::Pending,
        ];
    }

    public function approved(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => RequestStatus::Approved,
            'decision_note' => 'Disetujui.',
            'decided_at' => now(),
        ]);
    }
}
