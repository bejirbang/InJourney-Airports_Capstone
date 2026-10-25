<?php

namespace Database\Seeders;

use App\Models\Office;
use App\Models\User;
use App\Models\WorkHourSetting;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

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
            'title' => 'Senior Engineer',
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

        Office::factory()->create([
            'name' => 'Kantor Pusat Terminal 3',
            'latitude' => -6.1256,
            'longitude' => 106.6559,
            'clock_in_radius_meters' => 100,
            'clock_out_radius_meters' => 300,
        ]);

        WorkHourSetting::factory()->create([
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
            'effective_from' => now()->startOfYear()->toDateString(),
        ]);
    }
}
