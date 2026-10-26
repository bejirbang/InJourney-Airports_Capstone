<?php

namespace Database\Factories;

use App\Models\Airport;
use App\Models\InternProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InternProfile>
 */
class InternProfileFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->state(['role' => 'intern']),
            'mentor_id' => User::factory()->mentor(),
            'airport_id' => Airport::factory(),
            'institution_type' => 'universitas',
            'university' => 'Universitas Indonesia',
            'major' => 'Teknik Informatika',
            'student_number' => fake()->unique()->numerify('##########'),
            'start_date' => now()->subMonth()->toDateString(),
            'end_date' => now()->addMonths(2)->toDateString(),
            'leave_quota_since' => fn (array $attributes) => $attributes['start_date'],
        ];
    }
}
