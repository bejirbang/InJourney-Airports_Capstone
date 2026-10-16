<?php

namespace Database\Factories;

use App\Models\Attendance;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Attendance>
 */
class AttendanceFactory extends Factory
{
    /**
     * Hari ini, sudah clock in dan clock out.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'intern_id' => User::factory()->intern(),
            'date' => now()->toDateString(),
            'clock_in_at' => '08:00:00',
            'clock_out_at' => '17:00:00',
            'is_corrected' => false,
        ];
    }

    /**
     * Sudah clock in, belum clock out.
     */
    public function clockedIn(): static
    {
        return $this->state(fn (array $attributes) => [
            'clock_out_at' => null,
        ]);
    }
}
