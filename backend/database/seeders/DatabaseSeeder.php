<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Data contoh untuk development. Semua akun memakai password "password".
 * Production tidak memakai seeder ini; admin pertama dibuat dengan `php artisan app:create-admin`.
 */
class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('Seeder data contoh tidak boleh dijalankan di production.');
        }

        User::factory()->admin()->create([
            'name' => 'Admin Contoh',
            'email' => 'admin@injourney.test',
            'title' => 'HR Admin',
        ]);

        $mentor = User::factory()->mentor()->create([
            'name' => 'Mentor Contoh',
            'email' => 'mentor@injourney.test',
            'title' => 'Mentor unit',
        ]);

        User::factory()->intern(['mentor_id' => $mentor->id])->create([
            'name' => 'Intern Contoh',
            'email' => 'intern@injourney.test',
            'title' => 'UI/UX Design Intern',
        ]);

        User::factory()->intern(['mentor_id' => $mentor->id])->mustChangePassword()->create([
            'name' => 'Intern Baru',
            'email' => 'intern.baru@injourney.test',
            'title' => 'Backend Intern',
        ]);
    }
}
