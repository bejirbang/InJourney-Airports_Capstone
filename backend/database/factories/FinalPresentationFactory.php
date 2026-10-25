<?php

namespace Database\Factories;

use App\Enums\PresentationStatus;
use App\Models\FinalPresentation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FinalPresentation>
 */
class FinalPresentationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'intern_id' => User::factory()->intern(),
            'evidence_url' => 'https://drive.google.com/drive/folders/'.fake()->regexify('[A-Za-z0-9]{20}'),
            'status' => PresentationStatus::Pending,
            'submitted_at' => now(),
        ];
    }

    public function approved(?User $admin = null): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => PresentationStatus::Approved,
            'decided_by' => $admin?->id,
            'decided_at' => now(),
        ]);
    }

    public function revision(?User $admin = null, string $note = 'Link tidak bisa dibuka.'): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => PresentationStatus::Revision,
            'decided_by' => $admin?->id,
            'decision_note' => $note,
            'decided_at' => now(),
        ]);
    }
}
