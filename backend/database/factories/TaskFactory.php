<?php

namespace Database\Factories;

use App\Enums\TaskStatus;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Task>
 */
class TaskFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => 'TSK-'.fake()->unique()->numberBetween(1, 99999),
            'title' => fake()->sentence(3),
            'description' => fake()->paragraph(),
            'intern_id' => User::factory()->intern(),
            'mentor_id' => User::factory()->mentor(),
            'due_at' => now()->addDays(3),
            'status' => TaskStatus::Todo,
        ];
    }

    public function status(TaskStatus $status): static
    {
        return $this->state(fn (array $attributes) => ['status' => $status]);
    }
}
