<?php

namespace Database\Factories;

use App\Models\Airport;
use App\Models\AirportWeeklySchedule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Bandara selalu dibuat bersama jadwal mingguan: Senin-Jumat 08:00-17:00, Sabtu dan Minggu libur.
 *
 * @extends Factory<Airport>
 */
class AirportFactory extends Factory
{
    public const SCHEDULE_FROM = '2020-01-01';

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'Bandara '.fake()->unique()->city(),
            'is_active' => true,
        ];
    }

    public function configure(): static
    {
        return $this->afterCreating(function (Airport $airport): void {
            for ($day = 1; $day <= 7; $day++) {
                AirportWeeklySchedule::factory()->for($airport)->create([
                    'day_of_week' => $day,
                    'is_workday' => $day <= 5,
                    'start_time' => $day <= 5 ? '08:00:00' : null,
                    'end_time' => $day <= 5 ? '17:00:00' : null,
                    'effective_from' => self::SCHEDULE_FROM,
                ]);
            }
        });
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }
}
