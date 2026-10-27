<?php

namespace Database\Seeders;

use App\Services\SystemSettings;
use Illuminate\Database\Seeder;

/**
 * Data awal production: `php artisan db:seed --class=ProductionSeeder --force`. Aman dijalankan ulang.
 * Berisi pengaturan bawaan dan sembilan indikator penilaian. Admin pertama dibuat dengan `php artisan app:create-admin`.
 */
class ProductionSeeder extends Seeder
{
    public function run(): void
    {
        SystemSettings::seedDefaults();
        $this->call(AssessmentIndicatorSeeder::class);
    }
}
