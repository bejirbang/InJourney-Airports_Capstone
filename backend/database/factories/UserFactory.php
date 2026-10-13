<?php

namespace Database\Factories;

use App\Enums\Role;
use App\Models\InternProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * Default-nya mentor karena mentor tidak butuh data tambahan.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
            'role' => Role::Mentor,
            'title' => 'Mentor',
            'phone' => null,
            'is_active' => true,
            'must_change_password' => false,
        ];
    }

    public function admin(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => Role::Admin,
            'title' => 'Admin',
        ]);
    }

    public function mentor(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => Role::Mentor,
            'title' => 'Mentor',
        ]);
    }

    /**
     * Intern beserta profil magangnya. Tanpa argumen, magang sedang berjalan dan mentor dibuat baru.
     *
     * @param  array<string, mixed>  $profile
     */
    public function intern(array $profile = []): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => Role::Intern,
            'title' => 'Intern',
        ])->afterCreating(function (User $user) use ($profile): void {
            InternProfile::factory()->for($user)->create($profile);
        });
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }

    /**
     * Akun baru dibuat atau baru direset admin.
     */
    public function mustChangePassword(): static
    {
        return $this->state(fn (array $attributes) => [
            'must_change_password' => true,
        ]);
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
