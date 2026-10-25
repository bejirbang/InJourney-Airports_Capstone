<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\Warning;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Warning>
 */
class WarningFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'intern_id' => User::factory()->intern(),
            'author_id' => User::factory()->admin(),
            'body' => fake()->sentence(),
        ];
    }
}
