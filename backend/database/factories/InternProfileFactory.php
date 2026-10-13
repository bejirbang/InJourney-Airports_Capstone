<?php

namespace Database\Factories;

use App\Models\InternProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InternProfile>
 */
class InternProfileFactory extends Factory
{
    /**
     * Magang sedang berjalan: mulai sebulan lalu, selesai dua bulan lagi.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->state(['role' => 'intern', 'title' => 'Intern']),
            'mentor_id' => User::factory()->mentor(),
            'start_date' => now()->subMonth()->toDateString(),
            'end_date' => now()->addMonths(2)->toDateString(),
        ];
    }
}
