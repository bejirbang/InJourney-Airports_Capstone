<?php

namespace Database\Factories;

use App\Models\Airport;
use App\Models\AirportSpecialSchedule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AirportSpecialSchedule>
 */
class AirportSpecialScheduleFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'airport_id' => Airport::factory(),
            'name' => 'Jam kerja Ramadan',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(29)->toDateString(),
            'start_time' => '08:00:00',
            'end_time' => '15:00:00',
        ];
    }
}
