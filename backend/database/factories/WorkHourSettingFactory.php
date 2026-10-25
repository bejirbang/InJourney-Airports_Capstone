<?php

namespace Database\Factories;

use App\Models\WorkHourSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WorkHourSetting>
 */
class WorkHourSettingFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
            'effective_from' => now()->startOfYear()->toDateString(),
        ];
    }
}
