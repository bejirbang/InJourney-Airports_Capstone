<?php

namespace Database\Factories;

use App\Models\AssessmentIndicator;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssessmentIndicator>
 */
class AssessmentIndicatorFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'category' => null,
            'name' => ucfirst(fake()->unique()->word()),
            'description' => null,
            'weight' => null,
            'sort_order' => 0,
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }
}
