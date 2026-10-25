<?php

namespace Database\Factories;

use App\Enums\LogbookReviewAction;
use App\Models\Logbook;
use App\Models\LogbookReview;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LogbookReview>
 */
class LogbookReviewFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'logbook_id' => Logbook::factory(),
            'mentor_id' => User::factory()->mentor(),
            'action' => LogbookReviewAction::Revision,
            'comment' => fake()->sentence(),
        ];
    }

    public function approved(): static
    {
        return $this->state(fn (array $attributes) => [
            'action' => LogbookReviewAction::Approved,
            'comment' => null,
        ]);
    }
}
