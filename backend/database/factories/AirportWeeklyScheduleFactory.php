<?php

namespace Database\Factories;

use App\Models\Airport;
use App\Models\AirportWeeklySchedule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AirportWeeklySchedule>
 */
class AirportWeeklyScheduleFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'airport_id' => Airport::factory(),
            'day_of_week' => 1,
            'is_workday' => true,
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
            'effective_from' => now()->toDateString(),
        ];
    }

    public function off(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_workday' => false,
            'start_time' => null,
            'end_time' => null,
        ]);
    }
}
