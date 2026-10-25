<?php

namespace Database\Seeders;

use App\Services\SystemSettings;
use Illuminate\Database\Seeder;

/**
 * Data awal production: `php artisan db:seed --class=ProductionSeeder --force`. Aman dijalankan ulang.
 * Admin pertama dibuat dengan `php artisan app:create-admin`. Indikator penilaian ditambahkan di sini
 * setelah mitra mengirimkannya.
 */
class ProductionSeeder extends Seeder
{
    public function run(): void
    {
        SystemSettings::seedDefaults();
    }
}
