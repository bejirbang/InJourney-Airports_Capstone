<?php

namespace Database\Factories;

use App\Enums\AssessmentStatus;
use App\Models\Assessment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Assessment>
 */
class AssessmentFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'intern_id' => User::factory()->intern(),
            'mentor_id' => User::factory()->mentor(),
            'final_score' => null,
            'status' => AssessmentStatus::Draft,
        ];
    }

    public function submitted(string $finalScore = '85.00'): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => AssessmentStatus::Submitted,
            'final_score' => $finalScore,
            'submitted_at' => now(),
        ]);
    }
}
