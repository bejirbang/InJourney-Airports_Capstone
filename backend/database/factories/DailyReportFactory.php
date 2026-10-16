<?php

namespace Database\Factories;

use App\Models\Attendance;
use App\Models\DailyReport;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DailyReport>
 */
class DailyReportFactory extends Factory
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
            'sent_at' => now(),
        ];
    }
}
